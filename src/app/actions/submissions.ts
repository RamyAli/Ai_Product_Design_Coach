"use server";

import { z } from "zod";
import { runAction } from "@/server/action";
import { addFigmaLink, processAsset, removeAsset } from "@/server/ingestion/pipeline";
import { estimateReview, requestReview } from "@/server/services/reviews";
import { discardDraft, ensureDraft, saveDraft, startDraftFromVersion, submitDraft } from "@/server/services/submissions";
import { toAssetDto } from "@/server/dto";

const id = z.string().min(1).max(64);

export async function ensureDraftAction(stageId: string) {
  return runAction(async () => {
    const draft = await ensureDraft(id.parse(stageId));
    return { submissionId: draft.id };
  });
}

export async function saveDraftAction(submissionId: string, data: { textContent?: string; notes?: string }) {
  return runAction(async () => {
    const parsed = z.object({ textContent: z.string().optional(), notes: z.string().optional() }).parse(data);
    const s = await saveDraft(id.parse(submissionId), parsed);
    return { updatedAt: s.updatedAt.toISOString() };
  });
}

export async function addFigmaLinkAction(submissionId: string, url: string) {
  return runAction(async () => toAssetDto(await addFigmaLink({ submissionId: id.parse(submissionId), url: z.string().max(2000).parse(url) })));
}

export async function removeAssetAction(assetId: string) {
  return runAction(async () => {
    await removeAsset(id.parse(assetId));
    return null;
  });
}

export async function retryAssetAction(assetId: string) {
  return runAction(async () => toAssetDto(await processAsset(id.parse(assetId))));
}

export async function estimateReviewAction(submissionId: string) {
  return runAction(async () => estimateReview(id.parse(submissionId)));
}

/** Submits the draft as a new version and immediately starts its formal review. */
export async function submitDraftAction(submissionId: string, opts: { confirmReopen?: boolean } = {}) {
  return runAction(async () => {
    const result = await submitDraft(id.parse(submissionId), { confirmReopen: Boolean(opts.confirmReopen) });
    const job = await requestReview(result.submissionId);
    return { ...result, jobId: job.id };
  });
}

export async function requestReviewAction(submissionId: string) {
  return runAction(async () => ({ jobId: (await requestReview(id.parse(submissionId))).id }));
}

export async function startDraftFromVersionAction(stageId: string, fromSubmissionId: string) {
  return runAction(async () => {
    const draft = await startDraftFromVersion(id.parse(stageId), id.parse(fromSubmissionId));
    return { submissionId: draft!.id };
  });
}

export async function discardDraftAction(submissionId: string) {
  return runAction(async () => {
    await discardDraft(id.parse(submissionId));
    return null;
  });
}
