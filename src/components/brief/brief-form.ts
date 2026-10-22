import { z } from "zod";
import type { BriefCore, ProjectBrief } from "@/domain/brief";
import { DifficultySchema, ExperienceLevelSchema, LocaleSchema, PlatformSchema } from "@/domain/enums";

const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);

export const BriefFormSchema = z.object({
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().min(10).max(1200),
  problemContext: z.string().trim().max(3000),
  problemStatement: z.string().trim().min(10).max(2000),
  businessOpportunity: z.string().trim().max(2000),
  industry: z.string().trim().min(1).max(120),
  market: z.string().trim().max(160),
  platform: PlatformSchema,
  experienceLevel: ExperienceLevelSchema,
  difficulty: DifficultySchema,
  language: LocaleSchema,
  targetUsers: z
    .array(z.object({ segment: z.string().trim().min(1).max(160), description: z.string().trim().max(800), needs: z.string().max(2000) }))
    .min(1)
    .max(5),
  focusFeatures: z
    .array(z.object({ id: z.string(), name: z.string().trim().min(1).max(120), description: z.string().trim().max(800), userValue: z.string().trim().max(400) }))
    .min(2)
    .max(4),
  successMetrics: z.array(z.object({ metric: z.string().trim().min(1).max(300), target: z.string().trim().max(200), rationale: z.string().trim().max(500) })).min(1).max(8),
  primaryUserGoals: z.string().max(3000),
  businessObjectives: z.string().trim().min(1).max(3000),
  constraints: z.string().max(3000),
  inScope: z.string().max(3000),
  outOfScope: z.string().max(3000),
  assumptions: z.string().max(3000),
  risks: z.string().max(3000),
  edgeCases: z.string().max(3000),
  estimatedEffort: z.string().trim().max(160),
  challengeRationale: z.string().trim().max(1500),
});
export type BriefFormValues = z.infer<typeof BriefFormSchema>;

export function briefToForm(b: BriefCore): BriefFormValues {
  const join = (a: string[]) => a.join("\n");
  return {
    title: b.title,
    summary: b.summary,
    problemContext: b.problemContext,
    problemStatement: b.problemStatement,
    businessOpportunity: b.businessOpportunity,
    industry: b.industry,
    market: b.market,
    platform: b.platform,
    experienceLevel: b.experienceLevel,
    difficulty: b.difficulty,
    language: b.language,
    targetUsers: b.targetUsers.map((u) => ({ segment: u.segment, description: u.description, needs: join(u.needs) })),
    focusFeatures: b.focusFeatures.map((f) => ({ ...f })),
    successMetrics: b.successMetrics.map((m) => ({ ...m })),
    primaryUserGoals: join(b.primaryUserGoals),
    businessObjectives: join(b.businessObjectives),
    constraints: join(b.constraints),
    inScope: join(b.inScope),
    outOfScope: join(b.outOfScope),
    assumptions: join(b.assumptions),
    risks: join(b.risks),
    edgeCases: join(b.edgeCases),
    estimatedEffort: b.estimatedEffort,
    challengeRationale: b.challengeRationale,
  };
}

export function formToBrief(v: BriefFormValues): Omit<ProjectBrief, "workflow"> {
  return {
    title: v.title,
    summary: v.summary,
    problemContext: v.problemContext,
    problemStatement: v.problemStatement,
    businessOpportunity: v.businessOpportunity,
    industry: v.industry,
    market: v.market,
    platform: v.platform,
    experienceLevel: v.experienceLevel,
    difficulty: v.difficulty,
    language: v.language,
    targetUsers: v.targetUsers.map((u) => ({ segment: u.segment, description: u.description, needs: lines(u.needs) })),
    focusFeatures: v.focusFeatures.map((f, i) => ({ ...f, id: f.id || `feature_${i + 1}` })),
    successMetrics: v.successMetrics,
    primaryUserGoals: lines(v.primaryUserGoals),
    businessObjectives: lines(v.businessObjectives),
    constraints: lines(v.constraints),
    inScope: lines(v.inScope),
    outOfScope: lines(v.outOfScope),
    assumptions: lines(v.assumptions),
    risks: lines(v.risks),
    edgeCases: lines(v.edgeCases),
    estimatedEffort: v.estimatedEffort,
    challengeRationale: v.challengeRationale,
  };
}
