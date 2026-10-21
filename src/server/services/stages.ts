import type { Decision, Severity, StageKey, StageStatus } from "@/domain/enums";
import { evaluateStageGate, type StageGateResult } from "@/domain/gates";
import type { StoredReview } from "@/domain/review";
import { downstreamStages } from "@/domain/stages/definitions";
import { db, parseJson } from "../db";
import { AppError, notFound } from "../errors";

export async function requireStage(stageId: string) {
  const stage = await db.stage.findUnique({ where: { id: stageId }, include: { project: true } });
  if (!stage) throw notFound("Stage");
  return stage;
}

/** Latest formal review of the stage and its open revision tasks. */
export async function latestReviewForStage(stageId: string) {
  return db.review.findFirst({
    where: { stageId },
    orderBy: { createdAt: "desc" },
    include: { revisionTasks: true, submission: { select: { versionNumber: true } } },
  });
}

export async function latestSubmittedForStage(stageId: string) {
  return db.submission.findFirst({ where: { stageId, status: "submitted" }, orderBy: { versionNumber: "desc" } });
}

export async function getStageGate(stageId: string): Promise<StageGateResult> {
  const stage = await requireStage(stageId);
  const [review, latestSubmitted, tasks] = await Promise.all([
    latestReviewForStage(stageId),
    latestSubmittedForStage(stageId),
    db.task.findMany({ where: { stageId, isMandatory: true }, select: { status: true } }),
  ]);
  const stored = review ? parseJson<StoredReview | null>(review.reviewJson, null) : null;
  return evaluateStageGate({
    status: stage.status as StageStatus,
    practiceMode: stage.project.practiceMode,
    latestSubmissionId: latestSubmitted?.id ?? null,
    latestReview: review
      ? {
          submissionId: review.submissionId,
          decision: review.decision as Decision,
          missingDeliverables: stored?.missingDeliverables ?? [],
          criticalIssueCount: stored?.issues.filter((i) => i.severity === "critical").length ?? 0,
        }
      : null,
    openRevisionTasks: (review?.revisionTasks ?? []).filter((t) => t.status === "open").map((t) => ({ severity: t.severity as Severity })),
    mandatoryTasks: tasks,
  });
}

export async function setTaskStatus(taskId: string, done: boolean) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw notFound("Task");
  return db.task.update({ where: { id: taskId }, data: { status: done ? "done" : "todo" } });
}

/** Moves the project's "current stage" pointer to the first stage that is not completed. */
async function refreshProjectPointer(projectId: string) {
  const stages = await db.stage.findMany({ where: { projectId }, orderBy: { orderIndex: "asc" } });
  const current = stages.find((s) => s.status !== "completed");
  const allDone = !current;
  await db.project.update({
    where: { id: projectId },
    data: {
      currentStageId: current?.id ?? stages[stages.length - 1]?.id ?? null,
      status: allDone ? "completed" : undefined,
      completedAt: allDone ? new Date() : null,
    },
  });
}

/**
 * Completes a stage only when the gate allows it, then unlocks the next stage.
 * Practice mode never bypasses this check.
 */
export async function completeStage(stageId: string) {
  const stage = await requireStage(stageId);
  const gate = await getStageGate(stageId);
  if (!gate.eligible) {
    throw new AppError("gate_blocked", "This stage cannot be completed yet.", gate.blockers);
  }
  await db.$transaction(async (tx) => {
    await tx.stage.update({ where: { id: stageId }, data: { status: "completed", completedAt: new Date(), revalidationReason: null } });
    const next = await tx.stage.findFirst({ where: { projectId: stage.projectId, orderIndex: stage.orderIndex + 1 } });
    if (next && next.status === "locked") await tx.stage.update({ where: { id: next.id }, data: { status: "available" } });
  });
  await refreshProjectPointer(stage.projectId);
  return requireStage(stageId);
}

/** Downstream stages that already have work and might be invalidated by changes to this stage. */
export async function downstreamWork(stageId: string) {
  const stage = await requireStage(stageId);
  const keys = downstreamStages(stage.stageKey as StageKey);
  if (keys.length === 0) return [];
  const stages = await db.stage.findMany({
    where: { projectId: stage.projectId, stageKey: { in: keys } },
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { submissions: { where: { status: "submitted" } } } } },
  });
  return stages
    .filter((s) => s.status === "completed" || s.status === "ready_to_complete" || s._count.submissions > 0)
    .map((s) => ({ id: s.id, stageKey: s.stageKey, title: s.title, status: s.status }));
}

export async function markStagesForRevalidation(projectId: string, stageIds: string[], reason: string) {
  const stages = await db.stage.findMany({ where: { projectId, id: { in: stageIds } } });
  await db.$transaction(
    stages
      .filter((s) => s.status !== "locked" && s.status !== "available")
      .map((s) =>
        db.stage.update({
          where: { id: s.id },
          data: { status: "needs_revalidation", completedAt: null, revalidationReason: reason.slice(0, 300) },
        }),
      ),
  );
  await refreshProjectPointer(projectId);
}

/** Reopens a completed stage when the user submits a new version (with explicit confirmation). */
export async function reopenStage(stageId: string) {
  const stage = await requireStage(stageId);
  if (stage.status !== "completed") return stage;
  await db.stage.update({ where: { id: stageId }, data: { status: "in_progress", completedAt: null } });
  await refreshProjectPointer(stage.projectId);
  return requireStage(stageId);
}

export async function setStageStatus(stageId: string, status: StageStatus) {
  const stage = await db.stage.findUnique({ where: { id: stageId } });
  if (!stage) throw notFound("Stage");
  return db.stage.update({
    where: { id: stageId },
    data: { status, startedAt: stage.startedAt ?? (status === "in_progress" ? new Date() : null) },
  });
}
