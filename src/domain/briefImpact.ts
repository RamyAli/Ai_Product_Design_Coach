import type { StageKey } from "./enums";
import type { ProjectBrief } from "./brief";

type BriefField = keyof Omit<ProjectBrief, "workflow">;

/** Which stages rely on each brief field. Used to explain the impact of brief edits. */
export const FIELD_STAGE_IMPACT: Partial<Record<BriefField, StageKey[]>> = {
  title: [],
  summary: ["discovery", "handoff"],
  problemContext: ["discovery", "research", "handoff"],
  problemStatement: ["discovery", "research", "architecture", "handoff"],
  businessOpportunity: ["discovery", "handoff"],
  targetUsers: ["discovery", "research", "architecture", "usability_testing"],
  industry: ["discovery", "research"],
  market: ["discovery", "research", "visual_design"],
  platform: ["wireframes", "visual_design", "prototype", "handoff"],
  experienceLevel: [],
  difficulty: [],
  language: ["visual_design", "handoff"],
  focusFeatures: ["architecture", "wireframes", "visual_design", "prototype", "usability_testing", "handoff"],
  primaryUserGoals: ["discovery", "architecture", "usability_testing"],
  businessObjectives: ["discovery", "handoff"],
  successMetrics: ["discovery", "usability_testing", "handoff"],
  constraints: ["discovery", "architecture", "wireframes", "visual_design"],
  inScope: ["discovery", "architecture"],
  outOfScope: ["discovery", "architecture"],
  assumptions: ["discovery", "research"],
  risks: ["discovery"],
  edgeCases: ["architecture", "wireframes"],
  estimatedEffort: [],
  challengeRationale: [],
};

export function changedBriefFields(before: ProjectBrief, after: ProjectBrief): BriefField[] {
  const fields = Object.keys(FIELD_STAGE_IMPACT) as BriefField[];
  return fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
}

export interface StageProgressSnapshot {
  stageId: string;
  stageKey: StageKey;
  status: string;
  submissionCount: number;
  reviewCount: number;
}

export interface BriefImpact {
  changedFields: BriefField[];
  /** Stages whose existing work may no longer match the brief */
  affectedStages: StageProgressSnapshot[];
  /** Stages that rely on changed fields but have no work yet — nothing to revalidate */
  untouchedStageKeys: StageKey[];
}

export function computeBriefImpact(before: ProjectBrief, after: ProjectBrief, stages: StageProgressSnapshot[]): BriefImpact {
  const changedFields = changedBriefFields(before, after);
  const keys = new Set<StageKey>();
  for (const f of changedFields) for (const k of FIELD_STAGE_IMPACT[f] ?? []) keys.add(k);
  const affectedStages = stages.filter(
    (s) => keys.has(s.stageKey) && (s.submissionCount > 0 || s.reviewCount > 0 || s.status === "completed"),
  );
  const untouchedStageKeys = [...keys].filter((k) => !affectedStages.some((s) => s.stageKey === k));
  return { changedFields, affectedStages, untouchedStageKeys };
}
