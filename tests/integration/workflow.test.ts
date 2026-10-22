import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { db, parseJson } from "@/server/db";
import { drainJobs, getJob } from "@/server/jobs/queue";
import { startBriefGeneration, type GeneratedBriefResult } from "@/server/services/generation";
import { createProject, readBrief, setPracticeMode, updateBrief, previewBriefImpact } from "@/server/services/projects";
import { discardDraft, ensureDraft, saveDraft, startDraftFromVersion, submitDraft } from "@/server/services/submissions";
import { ingestFile, addFigmaLink, removeAsset, assetAbsolutePath } from "@/server/ingestion/pipeline";
import { requestReview, updateRevisionTask, estimateReview } from "@/server/services/reviews";
import { completeStage, getStageGate } from "@/server/services/stages";
import { MockProvider } from "@/server/ai/mock";
import type { ReviewComparison, StoredReview } from "@/domain/review";
import { AppError } from "@/server/errors";
import { makePng, STRONG_DISCOVERY_SUBMISSION, WEAK_DISCOVERY_SUBMISSION } from "../fixtures/files";

async function generateBrief(input: Record<string, unknown> = { mode: "random", language: "en" }) {
  const job = await startBriefGeneration(input);
  await drainJobs();
  const done = await getJob(job.id);
  expect(done?.status).toBe("succeeded");
  return parseJson<GeneratedBriefResult>(done!.resultJson, null as never);
}

async function newProject() {
  const generated = await generateBrief();
  const project = await createProject({ brief: generated.brief, status: "active", generationSource: "mock" });
  const stages = await db.stage.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } });
  return { project, stages };
}

async function submitAndReview(stageId: string, text: string, extra?: (submissionId: string) => Promise<void>) {
  const draft = await ensureDraft(stageId);
  await saveDraft(draft.id, { textContent: text, notes: "Rationale notes" });
  if (extra) await extra(draft.id);
  await submitDraft(draft.id);
  const job = await requestReview(draft.id);
  await drainJobs();
  const finished = await getJob(job.id);
  return { submissionId: draft.id, job: finished! };
}

describe("project generation", () => {
  it("generates a random brief with 2–4 focus features and an eight-stage workflow", async () => {
    const result = await generateBrief();
    expect(result.source).toBe("mock");
    expect(result.brief.focusFeatures.length).toBeGreaterThanOrEqual(2);
    expect(result.brief.focusFeatures.length).toBeLessThanOrEqual(4);
    expect(result.brief.workflow).toHaveLength(8);
    expect(result.idea).not.toBeNull();
  });

  it("honours custom inputs including Arabic language and selected features", async () => {
    const result = await generateBrief({
      mode: "custom",
      language: "ar",
      industry: "fintech",
      platform: "web",
      focusFeatures: ["onboarding", "notifications", "dashboard_analytics"],
      difficulty: "hard",
      experienceLevel: "advanced",
    });
    expect(result.brief.language).toBe("ar");
    expect(result.brief.platform).toBe("web");
    expect(result.brief.focusFeatures.map((f) => f.name)).toEqual(["التهيئة والانضمام", "الإشعارات", "لوحة المعلومات والتحليلات"]);
    expect(result.brief.difficulty).toBe("hard");
  });

  it("creates a project with eight stages, tasks and a brief version", async () => {
    const { project, stages } = await newProject();
    expect(stages).toHaveLength(8);
    expect(stages[0]!.status).toBe("available");
    expect(stages.slice(1).every((s) => s.status === "locked")).toBe(true);
    expect(project.currentStageId).toBe(stages[0]!.id);
    const tasks = await db.task.count({ where: { projectId: project.id } });
    expect(tasks).toBeGreaterThan(40);
    expect(await db.projectBriefVersion.count({ where: { projectId: project.id } })).toBe(1);
  });

  it("recovers from malformed model output with a corrective retry", async () => {
    MockProvider.rawOverride = [{ title: "broken" }];
    const result = await generateBrief();
    expect(result.brief.title.length).toBeGreaterThan(0);
  });
});

describe("submission, review and stage gates", () => {
  it("reviews a weak submission as revise, blocks completion, then passes a revised version", async () => {
    const { project, stages } = await newProject();
    const stage1 = stages[0]!;
    const png = await makePng();

    // Version 1: weak text + an image
    const v1 = await submitAndReview(stage1.id, WEAK_DISCOVERY_SUBMISSION, async (id) => {
      const asset = await ingestFile({ submissionId: id, filename: "../../etc/passwd sketch.png", bytes: png });
      expect(asset.extractionStatus).toBe("ready");
      expect(asset.originalFilename).toBe("passwd sketch.png");
      expect(asset.thumbnailPath).toBeTruthy();
      expect(fs.existsSync(assetAbsolutePath(asset.storagePath!))).toBe(true);
    });
    expect(v1.job.status).toBe("succeeded");
    const review1 = await db.review.findFirstOrThrow({ where: { submissionId: v1.submissionId }, include: { revisionTasks: true } });
    expect(review1.isMock).toBe(true);
    expect(review1.decision).toBe("revise");
    expect(review1.revisionTasks.length).toBeGreaterThan(0);
    const stored1 = parseJson<StoredReview>(review1.reviewJson, null as never);
    expect(stored1.missingDeliverables.length).toBeGreaterThan(0);
    expect(stored1.criteria.map((c) => c.id)).toEqual(["problem_clarity", "users_and_goals", "measurable_metrics", "assumptions_vs_evidence", "realistic_scope"]);
    expect((await db.stage.findUniqueOrThrow({ where: { id: stage1.id } })).status).toBe("needs_revision");

    // Failed stage cannot be completed
    await expect(completeStage(stage1.id)).rejects.toMatchObject({ code: "gate_blocked" });
    const gate = await getStageGate(stage1.id);
    expect(gate.blockers.map((b) => b.code)).toContain("review_not_passed");

    // Revision task handling
    const task = review1.revisionTasks[0]!;
    await expect(updateRevisionTask(task.id, "dismissed", "")).rejects.toBeInstanceOf(AppError);
    await updateRevisionTask(task.id, "completed", "Rewrote the problem statement");

    // Version 2: start from v1 (image carried over), strong text
    const draft2 = await startDraftFromVersion(stage1.id, v1.submissionId);
    expect(draft2!.assets).toHaveLength(1);
    await saveDraft(draft2!.id, { textContent: STRONG_DISCOVERY_SUBMISSION });
    const estimate = await estimateReview(draft2!.id);
    expect(estimate.isMock).toBe(true);
    await submitDraft(draft2!.id);
    const job2 = await requestReview(draft2!.id);
    await drainJobs();
    expect((await getJob(job2.id))!.status).toBe("succeeded");

    const reviews = await db.review.findMany({ where: { stageId: stage1.id }, orderBy: { createdAt: "asc" } });
    expect(reviews).toHaveLength(2);
    const review2 = reviews[1]!;
    expect(review2.decision).toBe("pass");
    expect(review2.overallScore).toBeGreaterThanOrEqual(80);
    expect(review2.previousReviewId).toBe(review1.id);
    const comparison = parseJson<ReviewComparison>(review2.comparisonJson, null as never);
    expect(comparison.scoreDelta).toBeGreaterThan(0);
    expect(comparison.resolved.length).toBeGreaterThan(0);
    // Historical review untouched
    expect((await db.review.findUniqueOrThrow({ where: { id: review1.id } })).reviewJson).toBe(review1.reviewJson);

    // Gate now only blocked by mandatory checklist tasks
    const gate2 = await getStageGate(stage1.id);
    expect(gate2.blockers.map((b) => b.code)).toEqual(["mandatory_tasks_incomplete"]);
    await db.task.updateMany({ where: { stageId: stage1.id, isMandatory: true }, data: { status: "done" } });
    const completed = await completeStage(stage1.id);
    expect(completed.status).toBe("completed");
    const stage2 = await db.stage.findUniqueOrThrow({ where: { id: stages[1]!.id } });
    expect(stage2.status).toBe("available");
    expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).currentStageId).toBe(stage2.id);
  });

  it("locks later stages unless practice mode is on, and practice mode never passes a stage", async () => {
    const { project, stages } = await newProject();
    await expect(ensureDraft(stages[2]!.id)).rejects.toMatchObject({ code: "forbidden_state" });
    await setPracticeMode(project.id, true);
    const draft = await ensureDraft(stages[2]!.id);
    expect(draft.status).toBe("draft");
    await expect(completeStage(stages[2]!.id)).rejects.toMatchObject({ code: "gate_blocked" });
    await discardDraft(draft.id);
  });

  it("rejects empty submissions and keeps work when the AI provider fails", async () => {
    const { stages } = await newProject();
    const draft = await ensureDraft(stages[0]!.id);
    await expect(submitDraft(draft.id)).rejects.toMatchObject({ code: "validation" });
    await saveDraft(draft.id, { textContent: STRONG_DISCOVERY_SUBMISSION });
    await submitDraft(draft.id);
    MockProvider.failNext = { code: "rate_limited", remaining: 1 };
    const job = await requestReview(draft.id);
    await drainJobs();
    const failed = await getJob(job.id);
    expect(failed!.status).toBe("failed");
    expect(failed!.errorCode).toBe("ai_rate_limited");
    expect(failed!.errorMessage).not.toMatch(/stack|Error:/);
    const stage = await db.stage.findUniqueOrThrow({ where: { id: stages[0]!.id } });
    expect(stage.status).toBe("in_progress");
    expect((await db.submission.findUniqueOrThrow({ where: { id: draft.id } })).textContent).toBe(STRONG_DISCOVERY_SUBMISSION);
    // Retry succeeds
    const retry = await requestReview(draft.id);
    await drainJobs();
    expect((await getJob(retry.id))!.status).toBe("succeeded");
  });

  it("does not allow editing submitted versions", async () => {
    const { stages } = await newProject();
    const { submissionId } = await submitAndReview(stages[0]!.id, STRONG_DISCOVERY_SUBMISSION);
    await expect(saveDraft(submissionId, { textContent: "changed" })).rejects.toMatchObject({ code: "forbidden_state" });
    await expect(ingestFile({ submissionId, filename: "a.png", bytes: await makePng() })).rejects.toMatchObject({ code: "forbidden_state" });
  });

  it("treats an inaccessible Figma link as unavailable evidence, not proof", async () => {
    const { project, stages } = await newProject();
    await setPracticeMode(project.id, true);
    const wireframes = stages[3]!;
    const { submissionId } = await submitAndReview(
      wireframes.id,
      "# Wireframes\nSee the Figma link.\n# Interaction notes\nTapping save shows a toast and returns to the list with the new item highlighted for three seconds so users notice it.",
      async (id) => {
        const link = await addFigmaLink({ submissionId: id, url: "https://www.figma.com/design/AbCdEfGhIjKlMnOp/My-file?node-id=1-2" });
        expect(link.extractionStatus).toBe("ready");
        expect(parseJson<{ access: string }>(link.extractionMetadataJson, { access: "" }).access).toBe("not_configured");
      },
    );
    const review = await db.review.findFirstOrThrow({ where: { submissionId } });
    const stored = parseJson<StoredReview>(review.reviewJson, null as never);
    expect(review.decision).toBe("needs_more_evidence");
    const visual = stored.criteria.find((c) => c.id === "task_support")!;
    expect(visual.status).toBe("not_evaluable");
    expect(stored.limitations.some((l) => l.includes("figma_not_configured"))).toBe(true);
  });

  it("rejects malformed Figma URLs and supports removing attachments", async () => {
    const { stages } = await newProject();
    const draft = await ensureDraft(stages[0]!.id);
    await expect(addFigmaLink({ submissionId: draft.id, url: "https://evil.example.com/design/abc" })).rejects.toMatchObject({ code: "invalid_figma_url" });
    const asset = await ingestFile({ submissionId: draft.id, filename: "x.png", bytes: await makePng("#ff0000") });
    await removeAsset(asset.id);
    expect(fs.existsSync(assetAbsolutePath(asset.storagePath!))).toBe(false);
  });
});

describe("brief revisions", () => {
  it("versions brief edits and marks only selected affected stages for revalidation", async () => {
    const { project, stages } = await newProject();
    await submitAndReview(stages[0]!.id, STRONG_DISCOVERY_SUBMISSION);
    const brief = readBrief(project);
    const edited = { ...brief, problemStatement: `${brief.problemStatement} (narrowed to first-time owners)` };
    const impact = await previewBriefImpact(project.id, edited);
    expect(impact.changedFields).toEqual(["problemStatement"]);
    expect(impact.affectedStages.map((s) => s.stageKey)).toEqual(["discovery"]);
    const result = await updateBrief({ projectId: project.id, brief: edited, changeSummary: "Narrowed problem", revalidateStageIds: [stages[0]!.id] });
    expect(result.version).toBe(2);
    expect((await db.stage.findUniqueOrThrow({ where: { id: stages[0]!.id } })).status).toBe("needs_revalidation");
    expect(await db.review.count({ where: { stageId: stages[0]!.id } })).toBe(1);
    expect(await db.projectBriefVersion.count({ where: { projectId: project.id } })).toBe(2);
  });
});
