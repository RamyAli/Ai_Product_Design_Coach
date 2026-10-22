import type { ReviewComparison, StoredReview } from "@/domain/review";
import { getProvider } from "../ai";
import { estimateCostUsd, estimateRequestTokens, hasKnownPrice } from "../ai/pricing";
import { db, parseJson } from "../db";
import { AppError, notFound } from "../errors";
import { createJob, isJobActive } from "../jobs/queue";
import { buildEvidence } from "./evaluation";
import { setStageStatus } from "./stages";

/** Starts a formal review for a submitted version (idempotent while a review job is active). */
export async function requestReview(submissionId: string) {
  const submission = await db.submission.findUnique({ where: { id: submissionId } });
  if (!submission) throw notFound("Submission");
  if (submission.status !== "submitted") throw new AppError("forbidden_state", "Submit this draft before requesting a review.");
  const active = await db.aiJob.findFirst({
    where: { submissionId, type: "review", status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
  if (active) return active;
  const job = await createJob({ type: "review", input: { submissionId }, projectId: submission.projectId, stageId: submission.stageId, submissionId });
  await setStageStatus(submission.stageId, "in_review");
  return job;
}

export interface ReviewEstimate {
  provider: string;
  model: string;
  isMock: boolean;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  imagesSent: number;
  pdfPagesSent: number;
  limitations: string[];
}

/** Pre-flight estimate shown before a review is started. Never reads file bytes. */
export async function estimateReview(submissionId: string): Promise<ReviewEstimate> {
  const submission = await db.submission.findUnique({ where: { id: submissionId }, include: { assets: true } });
  if (!submission) throw notFound("Submission");
  const provider = await getProvider();
  const evidence = await buildEvidence({
    textContent: submission.textContent,
    notes: submission.notes,
    assets: submission.assets,
    capabilities: provider.capabilities,
    readFiles: false,
  });
  const tokens = estimateRequestTokens({
    textChars: evidence.textChars,
    images: evidence.imageCount,
    pdfPages: evidence.pdfPagesAttached,
    outputTokens: 6000,
  });
  return {
    provider: provider.id,
    model: provider.model,
    isMock: provider.isMock,
    ...tokens,
    estimatedCostUsd: provider.isMock ? 0 : hasKnownPrice(provider.model) ? estimateCostUsd(provider.model, tokens.inputTokens, tokens.outputTokens) : null,
    imagesSent: evidence.imageCount,
    pdfPagesSent: evidence.pdfPagesAttached,
    limitations: evidence.context.codeLimitations,
  };
}

export async function getReviewDetail(reviewId: string) {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: {
      revisionTasks: { orderBy: { createdAt: "asc" } },
      submission: { include: { assets: { orderBy: { createdAt: "asc" } } } },
      stage: true,
      project: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!review) return null;
  return {
    ...review,
    stored: parseJson<StoredReview | null>(review.reviewJson, null),
    comparison: parseJson<ReviewComparison | null>(review.comparisonJson, null),
  };
}

export async function listProjectReviews(projectId: string) {
  return db.review.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { stage: { select: { title: true, orderIndex: true, stageKey: true } }, submission: { select: { versionNumber: true } }, _count: { select: { revisionTasks: true } } },
  });
}

/** Revision tasks are user-managed; the review itself is never modified. Dismissing requires a reason. */
export async function updateRevisionTask(taskId: string, status: "open" | "completed" | "dismissed", note?: string) {
  const task = await db.revisionTask.findUnique({ where: { id: taskId } });
  if (!task) throw notFound("Revision task");
  const trimmed = note?.trim() ?? "";
  if (status === "dismissed" && trimmed.length < 3) {
    throw new AppError("validation", "Give a short reason for dismissing this task.");
  }
  return db.revisionTask.update({
    where: { id: taskId },
    data: { status, resolutionNote: status === "open" ? null : trimmed || null },
  });
}

export async function activeReviewJobForStage(stageId: string) {
  const job = await db.aiJob.findFirst({ where: { stageId, type: "review" }, orderBy: { createdAt: "desc" } });
  return job && (isJobActive(job.status) || job.status === "failed") ? job : null;
}
