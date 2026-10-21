import { GeneratorInputSchema } from "@/domain/brief";
import type { Locale } from "@/domain/enums";
import { SAMPLE_IDEAS } from "../ai/mock/ideas";
import { buildMockBrief, buildMockCustomization } from "../ai/mock/generate";
import { db } from "../db";
import { deleteProject, createProject } from "./projects";

/** Creates a clearly labelled sample project so the app can be explored without an API key. */
export async function loadSampleProject(language: Locale) {
  const idea = SAMPLE_IDEAS[2]!;
  const input = GeneratorInputSchema.parse({ mode: "random", language, difficulty: "medium", experienceLevel: "intermediate", platform: idea.platform });
  const core = buildMockBrief(input, idea);
  const workflow = buildMockCustomization(core).stages;
  return createProject({ brief: { ...core, workflow }, status: "active", generationSource: "mock", generationModel: "offline-demo-v1", isSample: true });
}

export async function removeSampleProjects(): Promise<number> {
  const samples = await db.project.findMany({ where: { isSample: true }, select: { id: true } });
  for (const p of samples) await deleteProject(p.id);
  return samples.length;
}
