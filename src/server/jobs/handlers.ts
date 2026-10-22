import type { JobType } from "@/domain/enums";
import { runCaseStudyJob } from "../services/caseStudy";
import { runFollowUpJob } from "../services/coach";
import { runReviewJob } from "../services/evaluation";
import { runBriefGenerationJob, runCustomizeJob } from "../services/generation";
import type { JobHandler } from "./queue";

export const JOB_HANDLERS: Record<JobType, JobHandler> = {
  generate_brief: runBriefGenerationJob,
  customize_stages: runCustomizeJob,
  review: runReviewJob,
  follow_up: runFollowUpJob,
  case_study: runCaseStudyJob,
};
