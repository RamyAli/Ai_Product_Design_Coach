import { dataBlock } from "./shared";
import { PROMPT_VERSIONS } from "./versions";

export interface PreviousReviewContext {
  versionNumber: number;
  overallScore: number;
  decision: string;
  summary: string;
  tasks: { promptId: string; title: string; description: string; severity: string; userStatus: string; userNote: string | null }[];
}

/** Section appended to the evaluation prompt when an earlier formal review exists for the stage. */
export const revisionComparisonPrompt = {
  version: PROMPT_VERSIONS.revisionComparison,
  build(prev: PreviousReviewContext): string {
    return [
      "## Revision comparison",
      `This is a resubmission. The previous formal review (of version ${prev.versionNumber}) scored ${prev.overallScore}/100 with decision "${prev.decision}".`,
      dataBlock("previous_review_summary", prev.summary),
      dataBlock("previous_revision_tasks", JSON.stringify(prev.tasks, null, 2)),
      "For EVERY previous revision task, add an entry to previousTaskAssessments using its promptId as previousTaskId:",
      '- "resolved": the new submission visibly addresses it (cite evidence).',
      '- "partially_resolved": some progress, gaps remain.',
      '- "unresolved": not addressed. A user marking a task complete is not evidence; judge only the submission.',
      '- "not_assessable": the evidence needed to judge it is not available.',
      "Do not repeat a resolved issue as a new issue. Score the new submission on its own merits against the rubric; do not anchor on the previous score.",
    ].join("\n");
  },
};
