/** Versions of each server-side prompt template. Stored with every AI output that used them. */
export const PROMPT_VERSIONS = {
  ideaGeneration: "idea-generation@1.0.0",
  briefGeneration: "brief-generation@1.0.0",
  stageCustomization: "stage-customization@1.0.0",
  submissionEvaluation: "submission-evaluation@1.0.0",
  revisionComparison: "revision-comparison@1.0.0",
  followUp: "review-follow-up@1.0.0",
  caseStudy: "case-study-draft@1.0.0",
} as const;
