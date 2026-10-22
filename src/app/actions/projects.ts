"use server";

import { z } from "zod";
import { BriefEditSchema, ProjectBriefSchema } from "@/domain/brief";
import { runAction } from "@/server/action";
import { AppError } from "@/server/errors";
import { cancelJob, getJob } from "@/server/jobs/queue";
import { startBriefGeneration, startStageRetailoring, type GeneratedBriefResult } from "@/server/services/generation";
import {
  activateProject,
  createProject,
  deleteProject,
  previewBriefImpact,
  setPracticeMode,
  setProjectArchived,
  updateBrief,
} from "@/server/services/projects";
import { parseJson } from "@/server/db";
import { getSettings } from "@/server/settings";

const id = z.string().min(1).max(64);

export async function generateBriefAction(input: unknown, avoidTitles: string[] = []) {
  return runAction(async () => {
    const job = await startBriefGeneration(input, z.array(z.string().max(300)).max(5).parse(avoidTitles));
    return { jobId: job.id };
  });
}

/** Saves a generated (and possibly edited) brief as a project. */
export async function saveGeneratedProjectAction(input: { jobId: string; brief: unknown; asDraft: boolean }) {
  return runAction(async () => {
    const jobId = id.parse(input.jobId);
    const job = await getJob(jobId);
    if (!job || job.type !== "generate_brief" || job.status !== "succeeded") throw new AppError("not_found", "Generated brief not found.");
    const generated = parseJson<GeneratedBriefResult | null>(job.resultJson, null);
    if (!generated) throw new AppError("not_found", "Generated brief not found.");
    const edited = BriefEditSchema.parse(input.brief);
    const brief = ProjectBriefSchema.parse({ ...edited, workflow: generated.brief.workflow });
    const settings = await getSettings();
    const project = await createProject({
      brief,
      status: input.asDraft ? "draft" : "active",
      generationSource: generated.source,
      generationModel: generated.model,
      practiceMode: settings.defaultPracticeMode,
    });
    return { projectId: project.id };
  });
}

export async function previewBriefImpactAction(projectId: string, brief: unknown) {
  return runAction(async () => {
    const edited = BriefEditSchema.parse(brief);
    return previewBriefImpact(id.parse(projectId), ProjectBriefSchema.parse({ ...edited, workflow: [] }));
  });
}

export async function updateBriefAction(input: { projectId: string; brief: unknown; changeSummary: string; revalidateStageIds: string[] }) {
  return runAction(async () => {
    const edited = BriefEditSchema.parse(input.brief);
    const result = await updateBrief({
      projectId: id.parse(input.projectId),
      brief: ProjectBriefSchema.parse({ ...edited, workflow: [] }),
      changeSummary: z.string().max(500).parse(input.changeSummary ?? ""),
      revalidateStageIds: z.array(id).max(8).parse(input.revalidateStageIds ?? []),
    });
    return { version: result.version, changedFields: result.impact.changedFields };
  });
}

export async function retailorStagesAction(projectId: string) {
  return runAction(async () => ({ jobId: (await startStageRetailoring(id.parse(projectId))).id }));
}

export async function activateProjectAction(projectId: string) {
  return runAction(async () => {
    await activateProject(id.parse(projectId));
    return null;
  });
}

export async function setPracticeModeAction(projectId: string, enabled: boolean) {
  return runAction(async () => {
    await setPracticeMode(id.parse(projectId), z.boolean().parse(enabled));
    return null;
  });
}

export async function archiveProjectAction(projectId: string, archived: boolean) {
  return runAction(async () => {
    await setProjectArchived(id.parse(projectId), z.boolean().parse(archived));
    return null;
  });
}

export async function deleteProjectAction(projectId: string, confirmTitle: string) {
  return runAction(async () => {
    const pid = id.parse(projectId);
    const { requireProject } = await import("@/server/services/projects");
    const project = await requireProject(pid);
    if (confirmTitle.trim() !== project.title.trim()) throw new AppError("validation", "Type the project title exactly to confirm deletion.");
    await deleteProject(pid);
    return null;
  });
}

export async function cancelJobAction(jobId: string) {
  return runAction(async () => {
    await cancelJob(id.parse(jobId));
    return null;
  });
}

