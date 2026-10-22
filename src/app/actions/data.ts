"use server";

import { z } from "zod";
import { runAction } from "@/server/action";
import { AppError } from "@/server/errors";
import { clearAllData, createBackup } from "@/server/services/backup";
import { saveCaseStudy, startCaseStudyDraft } from "@/server/services/caseStudy";
import { loadSampleProject, removeSampleProjects } from "@/server/services/sample";
import { getSettings } from "@/server/settings";

export async function createBackupAction() {
  return runAction(async () => createBackup("manual"));
}

export async function clearAllDataAction(confirmation: string) {
  return runAction(async () => {
    if (confirmation !== "DELETE") throw new AppError("validation", 'Type DELETE to confirm.');
    await clearAllData();
    return null;
  });
}

export async function loadSampleProjectAction() {
  return runAction(async () => {
    const settings = await getSettings();
    const project = await loadSampleProject(settings.locale);
    return { projectId: project.id };
  });
}

export async function removeSampleProjectsAction() {
  return runAction(async () => ({ removed: await removeSampleProjects() }));
}

export async function draftCaseStudyAction(projectId: string) {
  return runAction(async () => ({ jobId: (await startCaseStudyDraft(z.string().min(1).parse(projectId))).id }));
}

export async function saveCaseStudyAction(projectId: string, markdown: string) {
  return runAction(async () => {
    const cs = await saveCaseStudy(z.string().min(1).parse(projectId), z.string().parse(markdown));
    return { updatedAt: cs.updatedAt.toISOString() };
  });
}
