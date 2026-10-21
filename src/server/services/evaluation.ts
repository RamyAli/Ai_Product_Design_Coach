import fs from "node:fs/promises";
import type { AiJob, SubmissionAsset } from "@prisma/client";
import type { Locale, Strictness } from "@/domain/enums";
import { compareReviews, type PreviousTaskRef } from "@/domain/comparison";
import { buildModelReviewSchema, type EvidenceManifestEntry, type StoredReview } from "@/domain/review";
import { checkModelOutputCompleteness, finalizeReview, type EvidenceContext } from "@/domain/scoring";
import { stageStatusAfterReview } from "@/domain/gates";
import { getStageDefinition, RUBRIC_VERSION } from "@/domain/stages/definitions";
import { getProvider } from "../ai";
import { evaluationPrompt, type EvaluationEvidenceBlock } from "../ai/prompts/evaluation";
import type { PreviousReviewContext } from "../ai/prompts/revisionComparison";
import type { AIProvider, ContentPart, EvaluationTaskContext } from "../ai/types";
import { LIMITS } from "../config";
import { db, parseJson } from "../db";
import { AppError, notFound } from "../errors";
import { assetAbsolutePath, type AssetMeta } from "../ingestion/pipeline";
import { getSettings } from "../settings";
import type { JobOutcome } from "../jobs/queue";
import { readBrief } from "./projects";
import { customizationForStage, rubricForStage } from "./rubric";

const MAX_PDF_DOCUMENT_PAGES = 20;

export interface BuiltEvidence {
  blocks: EvaluationEvidenceBlock[];
  attachments: ContentPart[];
  context: EvidenceContext;
  imageCount: number;
  pdfPagesAttached: number;
  textChars: number;
}

function truncate(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: `${text.slice(0, max)}\n[…truncated: ${text.length - max} more characters not sent to the reviewer]`, truncated: true };
}

/**
 * Builds the evidence the reviewer may use, applying provider capability checks and size limits.
 * Everything not sent (and why) is recorded so confidence and limitations are honest.
 */
export async function buildEvidence(params: {
  textContent: string;
  notes: string;
  assets: SubmissionAsset[];
  capabilities: AIProvider["capabilities"];
  readFiles?: boolean;
}): Promise<BuiltEvidence> {
  const { capabilities } = params;
  const readFiles = params.readFiles ?? true;
  const blocks: EvaluationEvidenceBlock[] = [];
  const attachments: ContentPart[] = [];
  const textByRef: Record<string, string> = {};
  const pageCountByRef: Record<string, number> = {};
  const codeLimitations: string[] = [];
  let confidenceCap = 100;
  let visualEvidenceAvailable = false;
  let visualSourcesUnavailable = false;
  let budget: number = LIMITS.maxReviewContextChars;
  let imageCount = 0;
  let pdfPagesAttached = 0;

  const addText = (block: EvaluationEvidenceBlock, limit: number) => {
    const t = truncate(block.text, Math.max(0, Math.min(limit, budget)));
    if (t.truncated) {
      codeLimitations.push(`truncated:${block.ref}`);
      confidenceCap = Math.min(confidenceCap, 85);
    }
    budget -= t.text.length;
    textByRef[block.ref] = block.text;
    blocks.push({ ...block, text: t.text });
  };

  if (params.textContent.trim()) {
    addText({ ref: "T1", kind: "text", label: "Written submission", text: params.textContent, available: true }, LIMITS.maxTextChars);
  }
  if (params.notes.trim()) {
    addText({ ref: "N1", kind: "notes", label: "Designer's notes and rationale", text: params.notes, available: true }, LIMITS.maxNotesChars);
  }

  let a = 0;
  let i = 0;
  let f = 0;
  for (const asset of params.assets) {
    const meta = parseJson<AssetMeta>(asset.extractionMetadataJson, {});
    if (asset.kind === "image") {
      const ref = `I${++i}`;
      const label = `Image: ${asset.originalFilename}`;
      if (asset.extractionStatus !== "ready" || !asset.analysisPath) {
        blocks.push({ ref, kind: "image", label, text: "", available: false, detail: "processing_failed" });
        codeLimitations.push(`unavailable:${ref}:processing_failed`);
        visualSourcesUnavailable = true;
        confidenceCap -= 15;
        continue;
      }
      if (!capabilities.vision) {
        blocks.push({ ref, kind: "image", label, text: "", available: false, detail: "provider_has_no_vision" });
        codeLimitations.push(`unavailable:${ref}:provider_has_no_vision`);
        visualSourcesUnavailable = true;
        continue;
      }
      if (imageCount >= LIMITS.maxImagesPerReview) {
        blocks.push({ ref, kind: "image", label, text: "", available: false, detail: "image_limit_reached" });
        codeLimitations.push(`unavailable:${ref}:image_limit_reached`);
        confidenceCap -= 5;
        continue;
      }
      if (readFiles) {
        const data = await fs.readFile(assetAbsolutePath(asset.analysisPath));
        if (data.length > capabilities.maxImageBytes) {
          blocks.push({ ref, kind: "image", label, text: "", available: false, detail: "image_too_large" });
          codeLimitations.push(`unavailable:${ref}:image_too_large`);
          continue;
        }
        attachments.push({ type: "image", mediaType: "image/jpeg", dataBase64: data.toString("base64"), label: `${ref} — ${asset.originalFilename}` });
      }
      imageCount++;
      visualEvidenceAvailable = true;
      blocks.push({ ref, kind: "image", label, text: "", available: true, detail: meta.width ? `${meta.width}×${meta.height}px` : undefined });
      continue;
    }

    if (asset.kind === "pdf") {
      const ref = `A${++a}`;
      const label = `PDF: ${asset.originalFilename}`;
      if (asset.extractionStatus !== "ready") {
        blocks.push({ ref, kind: "pdf", label, text: "", available: false, detail: "processing_failed" });
        codeLimitations.push(`unavailable:${ref}:processing_failed`);
        visualSourcesUnavailable = true;
        confidenceCap -= 15;
        continue;
      }
      const pages = meta.pageCount ?? 0;
      pageCountByRef[ref] = pages;
      const canAttach =
        capabilities.pdf && pages > 0 && pages <= MAX_PDF_DOCUMENT_PAGES && (asset.fileSize ?? 0) <= capabilities.maxPdfBytes && asset.storagePath;
      if (canAttach) {
        // The model reads both the text and the visuals of the PDF pages.
        if (readFiles) {
          const data = await fs.readFile(assetAbsolutePath(asset.storagePath!));
          attachments.push({ type: "pdf", dataBase64: data.toString("base64"), label: `${ref} — ${asset.originalFilename}` });
        }
        pdfPagesAttached += pages;
        visualEvidenceAvailable = true;
        textByRef[ref] = asset.extractedText ?? "";
        blocks.push({ ref, kind: "pdf", label, text: "", available: true, detail: `${pages} pages attached as a document (cite pages as p.N)` });
        continue;
      }
      if (meta.textLayer === "none") {
        blocks.push({ ref, kind: "pdf", label, text: "", available: false, detail: "image_only_pdf_no_ocr" });
        codeLimitations.push(`unavailable:${ref}:image_only_pdf_no_ocr`);
        visualSourcesUnavailable = true;
        confidenceCap -= 15;
        continue;
      }
      addText({ ref, kind: "pdf", label, text: asset.extractedText ?? "", available: true, detail: `${pages} pages, extracted text only — visuals not reviewed` }, LIMITS.maxExtractedCharsPerAsset);
      codeLimitations.push(`text_only:${ref}`);
      if (meta.textLayer === "partial") confidenceCap -= 5;
      continue;
    }

    // Figma link
    const ref = `F${++f}`;
    const label = `Figma link: ${asset.sourceUrl ?? asset.originalFilename}`;
    if (meta.access === "granted") {
      addText({ ref, kind: "figma", label, text: asset.extractedText ?? "", available: true, detail: "file structure via Figma API (names only)" }, 6_000);
      for (const render of meta.renders ?? []) {
        if (!capabilities.vision || imageCount >= LIMITS.maxImagesPerReview) break;
        if (readFiles) {
          const data = await fs.readFile(assetAbsolutePath(render.path)).catch(() => null);
          if (!data) continue;
          attachments.push({ type: "image", mediaType: "image/jpeg", dataBase64: data.toString("base64"), label: `${ref} render — frame "${render.name}"` });
        }
        imageCount++;
        visualEvidenceAvailable = true;
      }
    } else {
      blocks.push({ ref, kind: "figma", label, text: "", available: false, detail: `figma_${meta.access ?? "not_configured"}` });
      codeLimitations.push(`unavailable:${ref}:figma_${meta.access ?? "not_configured"}`);
      visualSourcesUnavailable = true;
    }
  }

  const manifest: EvidenceManifestEntry[] = blocks.map((b) => ({ ref: b.ref, kind: b.kind, label: b.label, available: b.available, detail: b.detail }));
  return {
    blocks,
    attachments,
    imageCount,
    pdfPagesAttached,
    textChars: blocks.reduce((s, b) => s + b.text.length, 0),
    context: {
      manifest,
      textByRef,
      pageCountByRef,
      visualEvidenceAvailable,
      visualSourcesUnavailable: visualSourcesUnavailable && !visualEvidenceAvailable,
      confidenceCap: Math.max(0, confidenceCap),
      codeLimitations,
    },
  };
}

export interface ReviewJobInput {
  submissionId: string;
}

/** Job handler: performs one formal review of a submitted version and persists it immutably. */
export async function runReviewJob(job: AiJob, signal: AbortSignal): Promise<JobOutcome> {
  const input = parseJson<ReviewJobInput>(job.inputJson, { submissionId: "" });
  const submission = await db.submission.findUnique({
    where: { id: input.submissionId },
    include: { assets: { orderBy: { createdAt: "asc" } }, stage: true, project: true },
  });
  if (!submission) throw notFound("Submission");
  if (submission.status !== "submitted") throw new AppError("forbidden_state", "Only submitted versions can be reviewed.");

  const { stage, project } = submission;
  try {
    const settings = await getSettings();
    const provider = await getProvider();
    const brief = readBrief(project);
    const rubric = rubricForStage(stage);
    const def = getStageDefinition(stage.stageKey);
    const language = project.preferredLanguage as Locale;
    const strictness = settings.strictness as Strictness;

    const evidence = await buildEvidence({
      textContent: submission.textContent,
      notes: submission.notes,
      assets: submission.assets,
      capabilities: provider.capabilities,
    });

    // Previous formal review of this stage (any earlier version).
    const previousReview = await db.review.findFirst({
      where: { stageId: stage.id, submissionId: { not: submission.id } },
      orderBy: { createdAt: "desc" },
      include: { revisionTasks: { orderBy: { createdAt: "asc" } }, submission: { select: { versionNumber: true } } },
    });
    const previousTasks: (PreviousTaskRef & { reviewTaskKey: string })[] = (previousReview?.revisionTasks ?? []).map((t, idx) => ({
      id: t.id,
      promptId: `P${idx + 1}`,
      title: t.title,
      reviewTaskKey: t.reviewTaskKey,
    }));
    const previousContext: PreviousReviewContext | null = previousReview
      ? {
          versionNumber: previousReview.submission.versionNumber ?? 0,
          overallScore: previousReview.overallScore,
          decision: previousReview.decision,
          summary: previousReview.summary,
          tasks: previousReview.revisionTasks.map((t, idx) => ({
            promptId: `P${idx + 1}`,
            title: t.title,
            description: t.description,
            severity: t.severity,
            userStatus: t.status,
            userNote: t.resolutionNote,
          })),
        }
      : null;

    const prompt = evaluationPrompt.build({
      language,
      strictness,
      difficulty: project.difficulty as "easy" | "medium" | "hard",
      brief,
      stage: def,
      rubric,
      customization: customizationForStage(stage),
      evidence: evidence.blocks,
      attachments: evidence.attachments,
      previous: previousContext,
    });

    const criterionIds = rubric.criteria.map((c) => c.id) as [string, ...string[]];
    const deliverableIds = rubric.deliverables.map((d) => d.id) as [string, ...string[]];
    const schema = buildModelReviewSchema(criterionIds, deliverableIds);
    const mockContext: EvaluationTaskContext = {
      rubric,
      stageKey: stage.stageKey,
      language,
      strictness,
      texts: evidence.blocks.filter((b) => b.text.trim()).map((b) => ({ ref: b.ref, label: b.label, text: b.text })),
      visualRefs: evidence.context.visualEvidenceAvailable ? evidence.blocks.filter((b) => b.available && (b.kind === "image" || b.kind === "pdf")).map((b) => b.ref) : [],
      unavailableVisualRefs: evidence.blocks.filter((b) => !b.available).map((b) => b.ref),
      previousTasks: previousTasks.map((p) => ({ promptId: p.promptId, reviewTaskKey: p.reviewTaskKey })),
    };
    const result = await provider.generateStructured({
      task: { kind: "evaluate_submission", context: mockContext },
      system: prompt.system,
      content: prompt.content,
      schema,
      maxTokens: 16_000,
      signal,
      validate: (out) => checkModelOutputCompleteness(rubric, out),
    });

    const stored: StoredReview = finalizeReview({ rubric, output: result.data, evidence: evidence.context, strictness, language });
    const comparison = previousReview
      ? compareReviews({
          previousReviewId: previousReview.id,
          previous: parseJson<StoredReview>(previousReview.reviewJson, { overallScore: previousReview.overallScore, decision: previousReview.decision, criteria: [] } as unknown as StoredReview),
          current: stored,
          previousTasks,
        })
      : null;

    if (signal.aborted) throw new AppError("forbidden_state", "Cancelled.");
    const review = await db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          projectId: project.id,
          stageId: stage.id,
          submissionId: submission.id,
          provider: result.provider,
          model: result.model,
          isMock: provider.isMock,
          promptVersion: evaluationPrompt.fullVersion(Boolean(previousReview)),
          rubricVersion: RUBRIC_VERSION,
          overallScore: stored.overallScore,
          decision: stored.decision,
          confidence: stored.confidence,
          summary: stored.summary,
          reviewJson: JSON.stringify(stored),
          comparisonJson: comparison ? JSON.stringify(comparison) : null,
          previousReviewId: previousReview?.id ?? null,
          usageJson: result.usage ? JSON.stringify(result.usage) : null,
        },
      });
      if (stored.revisionTasks.length) {
        await tx.revisionTask.createMany({
          data: stored.revisionTasks.map((t) => ({
            reviewId: created.id,
            stageId: stage.id,
            reviewTaskKey: t.id.slice(0, 120),
            title: t.title.slice(0, 300),
            description: t.description.slice(0, 2000),
            reason: t.reason.slice(0, 1000),
            suggestedAction: t.suggestedAction.slice(0, 2000),
            severity: t.severity,
            criterionId: t.criterionId,
            theme: t.theme,
          })),
        });
      }
      await tx.stage.update({
        where: { id: stage.id },
        data: { status: stageStatusAfterReview(stored.decision), startedAt: stage.startedAt ?? new Date() },
      });
      return created;
    });
    return { result: { reviewId: review.id }, usage: result.usage, provider: result.provider, model: result.model };
  } catch (err) {
    // Preserve the submission; return the stage to a workable state.
    const latest = await db.review.findFirst({ where: { stageId: stage.id }, orderBy: { createdAt: "desc" } });
    await db.stage.update({
      where: { id: stage.id },
      data: { status: latest ? stageStatusAfterReview(latest.decision as "pass" | "revise" | "needs_more_evidence") : "in_progress" },
    });
    throw err;
  }
}
