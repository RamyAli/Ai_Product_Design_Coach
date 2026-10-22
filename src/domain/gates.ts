import type { Decision, Severity, StageStatus } from "./enums";

export type GateBlockerCode =
  | "stage_locked"
  | "already_completed"
  | "no_review"
  | "review_outdated"
  | "review_not_passed"
  | "missing_deliverables"
  | "open_critical_tasks"
  | "mandatory_tasks_incomplete";

export interface GateBlocker {
  code: GateBlockerCode;
  detail?: string;
  count?: number;
}

export interface StageGateInput {
  status: StageStatus;
  practiceMode: boolean;
  latestSubmissionId: string | null;
  latestReview: {
    submissionId: string;
    decision: Decision;
    missingDeliverables: string[];
    criticalIssueCount: number;
  } | null;
  openRevisionTasks: { severity: Severity }[];
  mandatoryTasks: { status: string }[];
}

export interface StageGateResult {
  eligible: boolean;
  blockers: GateBlocker[];
}

/**
 * A stage may be completed only when its latest formal review (of the latest submitted
 * version) passes, mandatory deliverables are present, critical revision tasks are
 * resolved and mandatory checklist tasks are done. Practice mode never bypasses this.
 */
export function evaluateStageGate(input: StageGateInput): StageGateResult {
  const blockers: GateBlocker[] = [];
  if (input.status === "completed") return { eligible: false, blockers: [{ code: "already_completed" }] };
  if (input.status === "locked" && !input.practiceMode) blockers.push({ code: "stage_locked" });

  const review = input.latestReview;
  if (!review) {
    blockers.push({ code: "no_review" });
  } else {
    if (input.latestSubmissionId && review.submissionId !== input.latestSubmissionId) {
      blockers.push({ code: "review_outdated" });
    }
    if (review.decision !== "pass") blockers.push({ code: "review_not_passed", detail: review.decision });
    if (review.missingDeliverables.length > 0) {
      blockers.push({ code: "missing_deliverables", count: review.missingDeliverables.length });
    }
    if (review.criticalIssueCount > 0 && review.decision === "pass") {
      // Defensive: a passing review can never carry critical issues (see finalizeReview).
      blockers.push({ code: "open_critical_tasks", count: review.criticalIssueCount });
    }
  }
  const openCritical = input.openRevisionTasks.filter((t) => t.severity === "critical").length;
  if (openCritical > 0) blockers.push({ code: "open_critical_tasks", count: openCritical });
  const incomplete = input.mandatoryTasks.filter((t) => t.status !== "done").length;
  if (incomplete > 0) blockers.push({ code: "mandatory_tasks_incomplete", count: incomplete });

  return { eligible: blockers.length === 0, blockers };
}

/** Whether the user may create submissions for a stage. Viewing is always allowed. */
export function canWorkOnStage(status: StageStatus, practiceMode: boolean): boolean {
  return status !== "locked" || practiceMode;
}

export function stageStatusAfterReview(decision: Decision): StageStatus {
  return decision === "pass" ? "ready_to_complete" : "needs_revision";
}
