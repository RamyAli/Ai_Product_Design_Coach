import { z } from "zod";
import {
  DifficultySchema,
  ExperienceLevelSchema,
  LocaleSchema,
  PlatformSchema,
  StageKeySchema,
} from "./enums";

const text = (max: number) => z.string().trim().max(max);

export const FocusFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  userValue: z.string(),
});
export type FocusFeature = z.infer<typeof FocusFeatureSchema>;

export const TargetUserSchema = z.object({
  segment: z.string(),
  description: z.string(),
  needs: z.array(z.string()),
});

export const SuccessMetricSchema = z.object({
  metric: z.string(),
  target: z.string(),
  rationale: z.string(),
});

/** Project-specific tailoring for one canonical stage. Never changes weights or removes canonical requirements. */
export const StagePlanSchema = z.object({
  stageKey: StageKeySchema,
  focus: z.string(),
  tailoredTasks: z.array(z.object({ title: z.string(), description: z.string() })),
  deliverableNotes: z.array(z.object({ deliverableId: z.string(), note: z.string() })),
  criteriaGuidance: z.array(z.object({ criterionId: z.string(), guidance: z.string() })),
});
export type StagePlan = z.infer<typeof StagePlanSchema>;

export const StageCustomizationOutputSchema = z.object({
  stages: z.array(StagePlanSchema),
});
export type StageCustomizationOutput = z.infer<typeof StageCustomizationOutputSchema>;

/** Shape the brief generator must return. Kept free of numeric/length constraints for structured outputs. */
export const BriefCoreSchema = z.object({
  title: z.string(),
  summary: z.string(),
  problemContext: z.string(),
  problemStatement: z.string(),
  businessOpportunity: z.string(),
  targetUsers: z.array(TargetUserSchema),
  industry: z.string(),
  market: z.string(),
  platform: PlatformSchema,
  experienceLevel: ExperienceLevelSchema,
  difficulty: DifficultySchema,
  language: LocaleSchema,
  focusFeatures: z.array(FocusFeatureSchema),
  primaryUserGoals: z.array(z.string()),
  businessObjectives: z.array(z.string()),
  successMetrics: z.array(SuccessMetricSchema),
  constraints: z.array(z.string()),
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  edgeCases: z.array(z.string()),
  estimatedEffort: z.string(),
  challengeRationale: z.string(),
});
export type BriefCore = z.infer<typeof BriefCoreSchema>;

export const ProjectBriefSchema = BriefCoreSchema.extend({
  workflow: z.array(StagePlanSchema).default([]),
});
export type ProjectBrief = z.infer<typeof ProjectBriefSchema>;

/** Domain-level validation applied after the model responds (the model schema cannot express these). */
export function validateBriefRules(brief: BriefCore): string[] {
  const problems: string[] = [];
  if (brief.focusFeatures.length < 2 || brief.focusFeatures.length > 4) {
    problems.push(`focusFeatures must contain 2–4 items (got ${brief.focusFeatures.length})`);
  }
  const names = brief.focusFeatures.map((f) => f.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) problems.push("focusFeatures must be distinct");
  if (brief.targetUsers.length === 0) problems.push("targetUsers must not be empty");
  if (brief.successMetrics.length === 0) problems.push("successMetrics must not be empty");
  if (brief.businessObjectives.length === 0) problems.push("businessObjectives must not be empty");
  if (!brief.title.trim()) problems.push("title must not be empty");
  if (!brief.problemStatement.trim()) problems.push("problemStatement must not be empty");
  return problems;
}

export const GeneratorInputSchema = z
  .object({
    mode: z.enum(["random", "custom"]),
    concept: text(300).optional(),
    industry: text(80).optional(),
    problemArea: text(300).optional(),
    targetAudience: text(300).optional(),
    market: text(120).optional(),
    platform: PlatformSchema.optional(),
    experienceLevel: ExperienceLevelSchema.default("intermediate"),
    difficulty: DifficultySchema.default("medium"),
    duration: text(80).optional(),
    focusFeatures: z.array(text(80).min(1)).max(4).default([]),
    language: LocaleSchema.default("en"),
    constraints: text(1000).optional(),
    portfolioOrientation: text(300).optional(),
  })
  .refine((v) => v.focusFeatures.length !== 1 || v.mode === "custom", {
    message: "Select 2–4 focus features, or none to let the coach choose.",
    path: ["focusFeatures"],
  });
export type GeneratorInput = z.infer<typeof GeneratorInputSchema>;

/** Editable brief fields exposed in the brief editor. */
export const BriefEditSchema = ProjectBriefSchema.omit({ workflow: true }).extend({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(10).max(1200),
  problemStatement: z.string().trim().min(10).max(2000),
});
