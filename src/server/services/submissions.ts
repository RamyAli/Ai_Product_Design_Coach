import { canWorkOnStage } from "@/domain/gates";
import type { StageStatus } from "@/domain/enums";
import { LIMITS } from "../config";
import { db } from "../db";
import { AppError, notFound } from "../errors";
import { removeAsset } from "../ingestion/pipeline";
import { reopenStage, requireStage, setStageStatus } from "./stages";

export async function getDraft(stageId: string) {
  return db.submission.findFirst({
    where: { stageId, status: "draft" },
    orderBy: { createdAt: "desc" },
    include: { assets: { orderBy: { createdAt: "asc" } } },
  });
}

/** Returns the stage's draft, creating one if needed. Locked stages accept work only in practice mode. */
export async function ensureDraft(stageId: string) {
  const existing = await getDraft(stageId);
  if (existing) return existing;
  const stage = await requireStage(stageId);
  if (!canWorkOnStage(stage.status as StageStatus, stage.project.practiceMode)) {
    throw new AppError("forbidden_state", "Complete the previous stage first, or turn on practice mode to work ahead.");
  }
  return db.submission.create({
    data: { projectId: stage.projectId, stageId, status: "draft" },
    include: { assets: true },
  });
}

export async function saveDraft(submissionId: string, data: { textContent?: string; notes?: string }) {
  const submission = await db.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw notFound("Draft");
  if (submission.status !== "draft") throw new AppError("forbidden_state", "Submitted versions cannot be edited.");
  if (data.textContent !== undefined && data.textContent.length > LIMITS.maxTextChars) {
    throw new AppError("validation", `Written work is limited to ${LIMITS.maxTextChars.toLocaleString("en")} characters. Attach longer documents as PDF.`);
  }
  if (data.notes !== undefined && data.notes.length > LIMITS.maxNotesChars) {
    throw new AppError("validation", `Notes are limited to ${LIMITS.maxNotesChars.toLocaleString("en")} characters.`);
  }
  return db.submission.update({
    where: { id: submissionId },
    data: { textContent: data.textContent ?? undefined, notes: data.notes ?? undefined },
  });
}

/** Starts a new draft pre-filled from an earlier version. Files are shared, not copied. */
export async function startDraftFromVersion(stageId: string, fromSubmissionId: string) {
  if (await getDraft(stageId)) throw new AppError("conflict", "A draft already exists for this stage. Open it instead.");
  const source = await db.submission.findUnique({ where: { id: fromSubmissionId }, include: { assets: true } });
  if (!source || source.stageId !== stageId) throw notFound("Version");
  const draft = await ensureDraft(stageId);
  await db.$transaction([
    db.submission.update({ where: { id: draft.id }, data: { textContent: source.textContent, notes: source.notes, basedOnId: source.id } }),
    ...source.assets.map((a) =>
      db.submissionAsset.create({
        data: {
          submissionId: draft.id,
          kind: a.kind,
          originalFilename: a.originalFilename,
          storedFilename: a.storedFilename,
          mimeType: a.mimeType,
          fileSize: a.fileSize,
          sha256: a.sha256,
          storagePath: a.storagePath,
          thumbnailPath: a.thumbnailPath,
          analysisPath: a.analysisPath,
          sourceUrl: a.sourceUrl,
          extractionStatus: a.extractionStatus,
          extractionError: a.extractionError,
          extractedText: a.extractedText,
          extractionMetadataJson: a.extractionMetadataJson,
        },
      }),
    ),
  ]);
  return getDraft(stageId);
}

export async function discardDraft(submissionId: string) {
  const submission = await db.submission.findUnique({ where: { id: submissionId }, include: { assets: true } });
  if (!submission) throw notFound("Draft");
  if (submission.status !== "draft") throw new AppError("forbidden_state", "Only drafts can be discarded.");
  for (const asset of submission.assets) await removeAsset(asset.id);
  await db.submission.delete({ where: { id: submissionId } });
}

export interface SubmitResult {
  submissionId: string;
  versionNumber: number;
  reopened: boolean;
}

/**
 * Locks a draft as the next numbered version. Requires content, no files still processing and
 * no failed files. Submitting to a completed stage reopens it, which the caller must confirm.
 */
export async function submitDraft(submissionId: string, opts: { confirmReopen?: boolean } = {}): Promise<SubmitResult> {
  const submission = await db.submission.findUnique({ where: { id: submissionId }, include: { assets: true } });
  if (!submission) throw notFound("Draft");
  if (submission.status !== "draft") throw new AppError("forbidden_state", "This version has already been submitted.");
  const stage = await requireStage(submission.stageId);
  if (!canWorkOnStage(stage.status as StageStatus, stage.project.practiceMode)) {
    throw new AppError("forbidden_state", "This stage is locked. Complete the previous stage or enable practice mode.");
  }
  const hasText = submission.textContent.trim().length > 0;
  if (!hasText && submission.assets.length === 0) {
    throw new AppError("validation", "Add written work, files or a Figma link before submitting.");
  }
  if (submission.assets.some((a) => ["uploaded", "validating", "extracting"].includes(a.extractionStatus))) {
    throw new AppError("validation", "Some files are still processing. Wait for them to finish before submitting.");
  }
  if (submission.assets.some((a) => a.extractionStatus === "failed")) {
    throw new AppError("validation", "Some files failed to process. Retry or remove them before submitting.");
  }
  let reopened = false;
  if (stage.status === "completed") {
    if (!opts.confirmReopen) {
      throw new AppError("conflict", "This stage is already complete. Submitting a new version reopens it until the new version passes review.");
    }
    await reopenStage(stage.id);
    reopened = true;
  }
  const last = await db.submission.aggregate({ where: { stageId: stage.id, status: "submitted" }, _max: { versionNumber: true } });
  const versionNumber = (last._max.versionNumber ?? 0) + 1;
  await db.submission.update({
    where: { id: submissionId },
    data: { status: "submitted", versionNumber, submittedAt: new Date() },
  });
  if (!["in_review"].includes(stage.status)) await setStageStatus(stage.id, "in_progress");
  await db.project.update({ where: { id: stage.projectId }, data: { lastOpenedAt: new Date(), status: stage.project.status === "completed" ? "active" : undefined } });
  return { submissionId, versionNumber, reopened };
}

export async function listSubmittedVersions(stageId: string) {
  return db.submission.findMany({
    where: { stageId, status: "submitted" },
    orderBy: { versionNumber: "desc" },
    include: {
      assets: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, select: { id: true, overallScore: true, decision: true, createdAt: true, isMock: true } },
    },
  });
}
