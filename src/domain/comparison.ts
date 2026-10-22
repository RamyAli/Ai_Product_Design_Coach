import type { ReviewComparison, StoredReview } from "./review";

export interface PreviousTaskRef {
  /** Database id of the RevisionTask */
  id: string;
  /** Short id shown to the reviewer, e.g. "P1" */
  promptId: string;
  title: string;
}

/**
 * Compares a new review with the previous review of the same stage. Uses the reviewer's
 * per-task assessments where available; anything it did not assess is reported as such.
 */
export function compareReviews(params: {
  previousReviewId: string;
  previous: Pick<StoredReview, "overallScore" | "decision" | "criteria">;
  current: StoredReview;
  previousTasks: PreviousTaskRef[];
}): ReviewComparison {
  const { previous, current, previousTasks } = params;
  const prevCriteria = new Map(previous.criteria.map((c) => [c.id, c]));
  const criteria = current.criteria.map((c) => {
    const p = prevCriteria.get(c.id);
    const prevScore = p ? p.score : null;
    return {
      id: c.id,
      name: c.name,
      previous: prevScore,
      current: c.score,
      delta: prevScore !== null && c.score !== null ? c.score - prevScore : null,
    };
  });

  const assessments = new Map(current.previousTaskAssessments.map((a) => [a.previousTaskId.trim(), a]));
  const resolved: ReviewComparison["resolved"] = [];
  const partiallyResolved: ReviewComparison["partiallyResolved"] = [];
  const unresolved: ReviewComparison["unresolved"] = [];
  const notAssessed: ReviewComparison["notAssessed"] = [];
  for (const task of previousTasks) {
    const a = assessments.get(task.promptId);
    if (!a || a.status === "not_assessable") {
      notAssessed.push({ taskId: task.id, title: task.title });
    } else if (a.status === "resolved") {
      resolved.push({ taskId: task.id, title: task.title, note: a.note });
    } else if (a.status === "partially_resolved") {
      partiallyResolved.push({ taskId: task.id, title: task.title, note: a.note });
    } else {
      unresolved.push({ taskId: task.id, title: task.title, note: a.note });
    }
  }

  return {
    previousReviewId: params.previousReviewId,
    previousScore: previous.overallScore,
    currentScore: current.overallScore,
    scoreDelta: current.overallScore - previous.overallScore,
    previousDecision: previous.decision,
    currentDecision: current.decision,
    criteria,
    resolved,
    partiallyResolved,
    unresolved,
    notAssessed,
    newIssues: current.issues.map((i) => ({ id: i.id, title: i.title, severity: i.severity })),
  };
}
