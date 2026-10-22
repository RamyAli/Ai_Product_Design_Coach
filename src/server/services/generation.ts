import type { AiJob } from "@prisma/client";
import { BriefCoreSchema, GeneratorInputSchema, StageCustomizationOutputSchema, validateBriefRules, type BriefCore, type GeneratorInput, type ProjectBrief, type StagePlan } from "@/domain/brief";
import { STAGE_KEYS } from "@/domain/enums";
import { getProvider } from "../ai";
import { addUsage } from "../ai/pricing";
import { briefGenerationPrompt } from "../ai/prompts/briefGeneration";
import { IdeaSchema, ideaGenerationPrompt, type Idea } from "../ai/prompts/ideaGeneration";
import { stageCustomizationPrompt } from "../ai/prompts/stageCustomization";
import { PROMPT_VERSIONS } from "../ai/prompts/versions";
import type { AIProvider, AIUsage } from "../ai/types";
import { db, parseJson } from "../db";
import { createJob } from "../jobs/queue";
import type { JobOutcome } from "../jobs/queue";
import { applyStagePlans, readBrief, recentProjectTitles, requireProject } from "./projects";

export interface GeneratedBriefResult {
  brief: ProjectBrief;
  source: "ai" | "mock";
  model: string;
  idea: Idea | null;
  workflowTailored: boolean;
  promptVersions: string[];
}

export async function startBriefGeneration(rawInput: unknown, extraAvoidTitles: string[] = []) {
  const input = GeneratorInputSchema.parse(rawInput);
  const avoidTitles = [...extraAvoidTitles.slice(0, 5).map((t) => t.slice(0, 200)), ...(await recentProjectTitles())];
  return createJob({ type: "generate_brief", input: { input, avoidTitles } });
}

async function tailorStages(provider: AIProvider, brief: BriefCore, signal: AbortSignal) {
  const prompt = stageCustomizationPrompt.build(brief);
  return provider.generateStructured({
    task: { kind: "customize_stages", brief },
    system: prompt.system,
    content: [{ type: "text", text: prompt.text }],
    schema: StageCustomizationOutputSchema,
    maxTokens: 12_000,
    signal,
    validate: (out) => {
      const missing = STAGE_KEYS.filter((k) => !out.stages.some((s) => s.stageKey === k));
      return missing.length ? [`missing stages: ${missing.join(", ")}`] : [];
    },
  });
}

/** Job: (random mode) idea → brief → stage tailoring. Tailoring failure does not discard the brief. */
export async function runBriefGenerationJob(job: AiJob, signal: AbortSignal): Promise<JobOutcome> {
  const { input, avoidTitles } = parseJson<{ input: GeneratorInput; avoidTitles: string[] }>(job.inputJson, { input: GeneratorInputSchema.parse({ mode: "random" }), avoidTitles: [] });
  const provider = await getProvider();
  let usage: AIUsage | null = null;
  let idea: Idea | null = null;
  const versions: string[] = [];

  if (input.mode === "random") {
    const p = ideaGenerationPrompt.build(input, avoidTitles);
    const ideaResult = await provider.generateStructured({
      task: { kind: "generate_idea", input, avoidTitles },
      system: p.system,
      content: [{ type: "text", text: p.text }],
      schema: IdeaSchema,
      maxTokens: 2_000,
      signal,
    });
    idea = ideaResult.data;
    usage = addUsage(usage, ideaResult.usage);
    versions.push(PROMPT_VERSIONS.ideaGeneration);
  }

  const bp = briefGenerationPrompt.build(input, idea, avoidTitles);
  const briefResult = await provider.generateStructured({
    task: { kind: "generate_brief", input, idea, avoidTitles },
    system: bp.system,
    content: [{ type: "text", text: bp.text }],
    schema: BriefCoreSchema,
    maxTokens: 10_000,
    signal,
    validate: validateBriefRules,
  });
  usage = addUsage(usage, briefResult.usage);
  versions.push(PROMPT_VERSIONS.briefGeneration);
  const core: BriefCore = {
    ...briefResult.data,
    language: input.language,
    platform: input.platform ?? briefResult.data.platform,
    experienceLevel: input.experienceLevel,
    difficulty: input.difficulty,
  };

  let workflow: StagePlan[] = [];
  let workflowTailored = false;
  try {
    const tailored = await tailorStages(provider, core, signal);
    workflow = tailored.data.stages;
    workflowTailored = true;
    usage = addUsage(usage, tailored.usage);
    versions.push(PROMPT_VERSIONS.stageCustomization);
  } catch (err) {
    if (signal.aborted) throw err;
    console.warn("[generation] stage tailoring failed; continuing with canonical workflow");
  }

  const result: GeneratedBriefResult = {
    brief: { ...core, workflow },
    source: provider.isMock ? "mock" : "ai",
    model: briefResult.model,
    idea,
    workflowTailored,
    promptVersions: versions,
  };
  return { result, usage, provider: provider.id, model: briefResult.model };
}

export async function startStageRetailoring(projectId: string) {
  await requireProject(projectId);
  return createJob({ type: "customize_stages", input: { projectId }, projectId });
}

/** Job: re-tailor stages after the brief changed. */
export async function runCustomizeJob(job: AiJob, signal: AbortSignal): Promise<JobOutcome> {
  const { projectId } = parseJson<{ projectId: string }>(job.inputJson, { projectId: "" });
  const project = await requireProject(projectId);
  const brief = readBrief(project);
  const provider = await getProvider();
  const result = await tailorStages(provider, brief, signal);
  await applyStagePlans(projectId, result.data.stages);
  await db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  return { result: { projectId }, usage: result.usage, provider: provider.id, model: result.model };
}
