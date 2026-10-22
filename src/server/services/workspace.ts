import type { StoredReview } from "@/domain/review";
import { getStageDefinition } from "@/domain/stages/definitions";
import { canWorkOnStage } from "@/domain/gates";
import type { StageStatus } from "@/domain/enums";
import { db, parseJson } from "../db";
import { listMentorMessages } from "./coach";
import { customizationForStage, rubricForStage } from "./rubric";
import { getStageGate } from "./stages";

/** Everything the stage workspace renders, loaded in one place. */
export async function getStageWorkspace(projectId: string, stageId: string) {
  const stage = await db.stage.findFirst({
    where: { id: stageId, projectId },
    include: { project: true, tasks: { orderBy: { orderIndex: "asc" } } },
  });
  if (!stage) return null;
  const [allStages, draft, versions, latestReview, gate, messages, reviewJob, mentorJob] = await Promise.all([
    db.stage.findMany({ where: { projectId }, orderBy: { orderIndex: "asc" }, select: { id: true, title: true, status: true, orderIndex: true, stageKey: true } }),
    db.submission.findFirst({ where: { stageId, status: "draft" }, include: { _count: { select: { assets: true } } } }),
    db.submission.findMany({
      where: { stageId, status: "submitted" },
      orderBy: { versionNumber: "desc" },
      include: {
        _count: { select: { assets: true } },
        reviews: { orderBy: { createdAt: "desc" }, select: { id: true, overallScore: true, decision: true, isMock: true, createdAt: true } },
      },
    }),
    db.review.findFirst({ where: { stageId }, orderBy: { createdAt: "desc" }, include: { revisionTasks: { orderBy: { createdAt: "asc" } }, submission: { select: { versionNumber: true } } } }),
    getStageGate(stageId),
    listMentorMessages({ projectId, stageId }),
    db.aiJob.findFirst({ where: { stageId, type: "review" }, orderBy: { createdAt: "desc" } }),
    db.aiJob.findFirst({ where: { stageId, type: "follow_up", status: { in: ["queued", "running"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const latestStored = latestReview ? parseJson<StoredReview | null>(latestReview.reviewJson, null) : null;
  // Show a review job only while it is active, or if it failed after the latest review was produced.
  const showJob =
    reviewJob &&
    (reviewJob.status === "queued" ||
      reviewJob.status === "running" ||
      ((reviewJob.status === "failed" || reviewJob.status === "cancelled") && (!latestReview || reviewJob.createdAt > latestReview.createdAt)));
  const index = allStages.findIndex((s) => s.id === stageId);
  return {
    stage,
    project: stage.project,
    definition: getStageDefinition(stage.stageKey),
    rubric: rubricForStage(stage),
    customization: customizationForStage(stage),
    allStages,
    nextStage: allStages[index + 1] ?? null,
    previousStage: allStages[index - 1] ?? null,
    canWork: canWorkOnStage(stage.status as StageStatus, stage.project.practiceMode),
    draft,
    versions,
    latestReview,
    latestStored,
    gate,
    messages,
    reviewJob: showJob ? reviewJob : null,
    mentorJobId: mentorJob?.id ?? null,
  };
}
