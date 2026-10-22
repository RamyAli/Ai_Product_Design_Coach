import type { Prisma } from "@prisma/client";
import { ProjectBriefSchema, type ProjectBrief, type StagePlan } from "@/domain/brief";
import { computeBriefImpact, type BriefImpact } from "@/domain/briefImpact";
import type { StageKey } from "@/domain/enums";
import { lt } from "@/domain/localized";
import { STAGE_DEFINITIONS } from "@/domain/stages/definitions";
import { db, parseJson } from "../db";
import { AppError, notFound } from "../errors";
import { deleteProjectFiles } from "../ingestion/pipeline";
import { snapshotFromDefinition } from "./rubric";

export interface CreateProjectOptions {
  brief: ProjectBrief;
  status: "draft" | "active";
  generationSource: "ai" | "mock" | "manual";
  generationModel?: string | null;
  practiceMode?: boolean;
  isSample?: boolean;
}

function projectColumns(brief: ProjectBrief) {
  return {
    title: brief.title.slice(0, 200),
    description: brief.summary,
    industry: brief.industry,
    market: brief.market || null,
    platform: brief.platform,
    experienceLevel: brief.experienceLevel,
    difficulty: brief.difficulty,
    preferredLanguage: brief.language,
  };
}

function tailoredTaskRows(plan: StagePlan | undefined, startIndex: number, projectId: string, stageId: string): Prisma.TaskCreateManyInput[] {
  return (plan?.tailoredTasks ?? []).slice(0, 3).map((t, i) => ({
    projectId,
    stageId,
    title: t.title.slice(0, 200),
    description: t.description.slice(0, 1000),
    taskType: "tailored",
    isMandatory: false,
    orderIndex: startIndex + i,
  }));
}

/** Creates a project with its brief history, the eight canonical stages and their task checklists. */
export async function createProject(opts: CreateProjectOptions) {
  const brief = ProjectBriefSchema.parse(opts.brief);
  const lang = brief.language;
  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        ...projectColumns(brief),
        status: opts.status,
        briefJson: JSON.stringify(brief),
        briefVersion: 1,
        practiceMode: opts.practiceMode ?? false,
        isSample: opts.isSample ?? false,
        generationSource: opts.generationSource,
        generationModel: opts.generationModel ?? null,
        lastOpenedAt: new Date(),
      },
    });
    await tx.projectBriefVersion.create({
      data: {
        projectId: project.id,
        versionNumber: 1,
        briefJson: JSON.stringify(brief),
        changeSummary: opts.generationSource === "manual" ? "Created" : `Generated (${opts.generationSource})`,
        source: opts.generationSource === "manual" ? "user" : opts.generationSource,
      },
    });
    let firstStageId: string | null = null;
    for (const def of STAGE_DEFINITIONS) {
      const plan = brief.workflow.find((w) => w.stageKey === def.key);
      const stage = await tx.stage.create({
        data: {
          projectId: project.id,
          stageKey: def.key,
          title: lt(def.title, lang),
          description: lt(def.objective, lang),
          orderIndex: def.order,
          status: def.order === 1 ? "available" : "locked",
          customizationJson: plan ? JSON.stringify(plan) : null,
          ...snapshotFromDefinition(def),
        },
      });
      if (def.order === 1) firstStageId = stage.id;
      await tx.task.createMany({
        data: [
          ...def.tasks.map((t, i) => ({
            projectId: project.id,
            stageId: stage.id,
            taskKey: t.key,
            title: lt(t.title, lang),
            taskType: "canonical",
            isMandatory: t.mandatory,
            orderIndex: i,
          })),
          ...tailoredTaskRows(plan, def.tasks.length, project.id, stage.id),
        ],
      });
    }
    return tx.project.update({ where: { id: project.id }, data: { currentStageId: firstStageId } });
  });
}

/** Applies (or re-applies) project-specific stage tailoring. Completed tailored tasks are kept. */
export async function applyStagePlans(projectId: string, plans: StagePlan[]): Promise<void> {
  const stages = await db.stage.findMany({ where: { projectId }, include: { tasks: true } });
  await db.$transaction(async (tx) => {
    for (const stage of stages) {
      const plan = plans.find((p) => p.stageKey === stage.stageKey);
      if (!plan) continue;
      await tx.stage.update({ where: { id: stage.id }, data: { customizationJson: JSON.stringify(plan) } });
      await tx.task.deleteMany({ where: { stageId: stage.id, taskType: "tailored", status: "todo" } });
      const maxOrder = stage.tasks.reduce((m, t) => Math.max(m, t.orderIndex), 0);
      const rows = tailoredTaskRows(plan, maxOrder + 1, projectId, stage.id);
      if (rows.length) await tx.task.createMany({ data: rows });
    }
    const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const brief = parseJson<ProjectBrief>(project.briefJson, null as unknown as ProjectBrief);
    if (brief) {
      await tx.project.update({ where: { id: projectId }, data: { briefJson: JSON.stringify({ ...brief, workflow: plans }) } });
    }
  });
}

export async function requireProject(id: string) {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw notFound("Project");
  return project;
}

export function readBrief(project: { briefJson: string }): ProjectBrief {
  const parsed = ProjectBriefSchema.safeParse(parseJson(project.briefJson, {}));
  if (!parsed.success) throw new AppError("internal", "The saved brief could not be read.");
  return parsed.data;
}

export async function listProjects() {
  return db.project.findMany({
    where: { status: { not: "archived" } },
    orderBy: [{ updatedAt: "desc" }],
    include: { stages: { select: { id: true, stageKey: true, status: true, orderIndex: true, title: true } } },
  });
}

export async function stageProgressSnapshots(projectId: string) {
  const stages = await db.stage.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    include: { _count: { select: { submissions: { where: { status: "submitted" } }, reviews: true } } },
  });
  return stages.map((s) => ({
    stageId: s.id,
    stageKey: s.stageKey as StageKey,
    status: s.status,
    submissionCount: s._count.submissions,
    reviewCount: s._count.reviews,
  }));
}

export async function previewBriefImpact(projectId: string, next: ProjectBrief): Promise<BriefImpact> {
  const project = await requireProject(projectId);
  return computeBriefImpact(readBrief(project), next, await stageProgressSnapshots(projectId));
}

/**
 * Saves an edited brief as a new version. Existing work is never deleted; stages the user
 * selects are marked for revalidation so they must pass a new review before counting as done.
 */
export async function updateBrief(params: { projectId: string; brief: ProjectBrief; changeSummary: string; revalidateStageIds: string[] }) {
  const project = await requireProject(params.projectId);
  const previous = readBrief(project);
  const brief = ProjectBriefSchema.parse({ ...params.brief, workflow: params.brief.workflow?.length ? params.brief.workflow : previous.workflow });
  const impact = computeBriefImpact(previous, brief, await stageProgressSnapshots(project.id));
  if (impact.changedFields.length === 0) return { project, impact, version: project.briefVersion };
  const version = project.briefVersion + 1;
  const allowedStageIds = new Set(impact.affectedStages.map((s) => s.stageId));
  const toRevalidate = params.revalidateStageIds.filter((id) => allowedStageIds.has(id));
  const updated = await db.$transaction(async (tx) => {
    await tx.projectBriefVersion.create({
      data: {
        projectId: project.id,
        versionNumber: version,
        briefJson: JSON.stringify(brief),
        changeSummary: params.changeSummary.trim().slice(0, 500) || `Edited: ${impact.changedFields.join(", ")}`,
        source: "user",
      },
    });
    for (const stageId of toRevalidate) {
      await tx.stage.update({
        where: { id: stageId },
        data: { status: "needs_revalidation", completedAt: null, revalidationReason: `Brief v${version}: ${impact.changedFields.join(", ")}` },
      });
    }
    return tx.project.update({
      where: { id: project.id },
      data: { ...projectColumns(brief), briefJson: JSON.stringify(brief), briefVersion: version, status: project.status === "completed" && toRevalidate.length ? "active" : project.status },
    });
  });
  return { project: updated, impact, version };
}

export async function activateProject(projectId: string) {
  const project = await requireProject(projectId);
  if (project.status !== "draft") return project;
  return db.project.update({ where: { id: projectId }, data: { status: "active" } });
}

export async function setPracticeMode(projectId: string, enabled: boolean) {
  await requireProject(projectId);
  return db.project.update({ where: { id: projectId }, data: { practiceMode: enabled } });
}

export async function setProjectArchived(projectId: string, archived: boolean) {
  const project = await requireProject(projectId);
  const status = archived ? "archived" : project.completedAt ? "completed" : "active";
  return db.project.update({ where: { id: projectId }, data: { status } });
}

export async function deleteProject(projectId: string): Promise<void> {
  await requireProject(projectId);
  await db.project.delete({ where: { id: projectId } });
  await deleteProjectFiles(projectId);
}

export async function touchProject(projectId: string): Promise<void> {
  await db.project.updateMany({ where: { id: projectId }, data: { lastOpenedAt: new Date() } });
}

export async function recentProjectTitles(limit = 15): Promise<string[]> {
  const rows = await db.project.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { title: true } });
  return rows.map((r) => r.title);
}
