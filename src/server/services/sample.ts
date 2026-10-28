import sharp from "sharp";
import { GeneratorInputSchema, type BriefCore } from "@/domain/brief";
import type { Locale } from "@/domain/enums";
import { lt } from "@/domain/localized";
import { getStageDefinition } from "@/domain/stages/definitions";
import { MockProvider } from "../ai/mock";
import { SAMPLE_IDEAS } from "../ai/mock/ideas";
import { buildMockBrief, buildMockCustomization } from "../ai/mock/generate";
import { db } from "../db";
import { ingestFile } from "../ingestion/pipeline";
import { reviewSubmission } from "./evaluation";
import { deleteProject, createProject } from "./projects";
import { completeStage } from "./stages";
import { ensureDraft, saveDraft, submitDraft } from "./submissions";

/** How far each sample project has progressed: stages completed, plus an optional stage left in revision. */
interface SamplePlan {
  ideaIndex: number;
  completedStages: number;
  revisingStage: boolean;
  /** Days ago the first submission was made; later stages follow every few days. */
  startedDaysAgo: number;
}

const SAMPLE_PLANS: SamplePlan[] = [
  { ideaIndex: 2, completedStages: 8, revisingStage: false, startedDaysAgo: 70 },
  { ideaIndex: 0, completedStages: 4, revisingStage: true, startedDaysAgo: 30 },
  { ideaIndex: 3, completedStages: 0, revisingStage: false, startedDaysAgo: 0 },
];

const DAY = 24 * 60 * 60 * 1000;

/**
 * The offline demo reviewer, told to treat attached sample wireframes as present so visual stages
 * can pass. Its reviews still say the image contents were not inspected.
 */
class SampleReviewer extends MockProvider {
  override readonly capabilities = { ...new MockProvider().capabilities, vision: true };
}

function buildSampleBrief(language: Locale, ideaIndex: number) {
  const idea = SAMPLE_IDEAS[ideaIndex]!;
  const input = GeneratorInputSchema.parse({ mode: "random", language, difficulty: "medium", experienceLevel: "intermediate", platform: idea.platform });
  const core = buildMockBrief(input, idea);
  return { ...core, workflow: buildMockCustomization(core).stages };
}

/**
 * Written work for a stage: one headed section per text deliverable, built from the brief.
 * Every section says it is sample content so it is never mistaken for real research.
 */
function sampleStageText(stageKey: string, brief: BriefCore, language: Locale, onlyFirst?: number): string {
  const def = getStageDefinition(stageKey);
  const users = brief.targetUsers.map((u) => u.segment).join(language === "ar" ? "، " : ", ");
  const features = brief.focusFeatures.map((f) => f.name).join(language === "ar" ? "، " : ", ");
  const note =
    language === "ar"
      ? "_محتوى تجريبي لاستكشاف التطبيق، وليس بحثاً أو نتائج حقيقية._"
      : "_Sample content for exploring the app, not real research or results._";
  const sections = def.deliverables.filter((d) => d.evidence !== "visual").slice(0, onlyFirst);
  const body = sections.map((d) => {
    const context =
      language === "ar"
        ? `في مشروع ${brief.title}، يركز هذا القسم على ${users} وعلى الميزات المحورية: ${features}. يوضح القسم القرارات المتخذة وأسبابها وما يحتاج إلى تحقق لاحقاً مع المستخدمين.`
        : `For ${brief.title}, this section focuses on ${users} and the focus features: ${features}. It explains the decisions made, the reasons behind them and what still needs to be validated with users.`;
    return `## ${lt(d.title, language)}\n${lt(d.description, language)} ${context}`;
  });
  return [note, ...body].join("\n\n");
}

/** A simple grey wireframe so visual stages have something attached. */
async function sampleWireframe(label: string): Promise<Buffer> {
  const safe = label.replace(/[<&>"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">
    <rect width="800" height="560" fill="#f4f4f4"/>
    <rect x="24" y="24" width="752" height="56" rx="8" fill="#e0e0e0"/>
    <rect x="24" y="104" width="200" height="432" rx="8" fill="#e0e0e0"/>
    <rect x="248" y="104" width="528" height="200" rx="8" fill="#d0e2ff"/>
    <rect x="248" y="328" width="252" height="208" rx="8" fill="#e0e0e0"/>
    <rect x="524" y="328" width="252" height="208" rx="8" fill="#e0e0e0"/>
    <text x="400" y="214" font-family="sans-serif" font-size="22" fill="#525252" text-anchor="middle">${safe}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function submitSampleVersion(stageId: string, stageKey: string, brief: BriefCore, language: Locale, provider: SampleReviewer, partial: boolean) {
  const draft = await ensureDraft(stageId);
  await saveDraft(draft.id, { textContent: sampleStageText(stageKey, brief, language, partial ? 2 : undefined) });
  const def = getStageDefinition(stageKey);
  if (!partial && def.deliverables.some((d) => d.evidence === "visual" || d.evidence === "link_or_visual")) {
    await ingestFile({ submissionId: draft.id, filename: `${stageKey}-sample.png`, bytes: await sampleWireframe(lt(def.title, language)) });
  }
  await submitDraft(draft.id);
  await reviewSubmission(draft.id, new AbortController().signal, provider);
  return draft.id;
}

/** Spreads sample activity over past days so the dashboard and progress pages have history. */
async function backdate(submissionId: string, at: Date) {
  await db.submission.update({ where: { id: submissionId }, data: { createdAt: at, submittedAt: at } });
  await db.review.updateMany({ where: { submissionId }, data: { createdAt: new Date(at.getTime() + 60_000) } });
}

async function createSampleProject(language: Locale, plan: SamplePlan, provider: SampleReviewer) {
  const brief = buildSampleBrief(language, plan.ideaIndex);
  const project = await createProject({ brief, status: "active", generationSource: "mock", generationModel: "offline-demo-v1", isSample: true });
  const stages = await db.stage.findMany({ where: { projectId: project.id }, orderBy: { orderIndex: "asc" } });
  const step = plan.completedStages > 0 ? Math.max(1, Math.floor(plan.startedDaysAgo / (plan.completedStages + 1))) : 0;

  for (const [i, stage] of stages.entries()) {
    const at = new Date(Date.now() - (plan.startedDaysAgo - i * step) * DAY);
    if (i < plan.completedStages) {
      const submissionId = await submitSampleVersion(stage.id, stage.stageKey, brief, language, provider, false);
      await db.task.updateMany({ where: { stageId: stage.id, isMandatory: true }, data: { status: "done" } });
      await completeStage(stage.id);
      await backdate(submissionId, at);
      await db.stage.update({ where: { id: stage.id }, data: { startedAt: at, completedAt: new Date(at.getTime() + 2 * 60_000) } });
    } else if (i === plan.completedStages && plan.revisingStage) {
      const submissionId = await submitSampleVersion(stage.id, stage.stageKey, brief, language, provider, true);
      await db.task.updateMany({ where: { stageId: stage.id, orderIndex: { lt: 2 } }, data: { status: "done" } });
      await backdate(submissionId, at);
      await db.stage.update({ where: { id: stage.id }, data: { startedAt: at } });
    }
  }
  return db.project.findUniqueOrThrow({ where: { id: project.id } });
}

/**
 * Creates three clearly labelled sample projects: one completed, one halfway through (with a
 * stage waiting on revisions) and one not started. Reviews always come from the offline demo
 * reviewer, even when a real provider is configured, so loading samples never costs anything.
 */
export async function loadSampleProjects(language: Locale) {
  const provider = new SampleReviewer();
  const created = [];
  // Oldest first so the not-started project is the most recently updated.
  for (const plan of SAMPLE_PLANS) created.push(await createSampleProject(language, plan, provider));
  return created;
}

export async function removeSampleProjects(): Promise<number> {
  const samples = await db.project.findMany({ where: { isSample: true }, select: { id: true } });
  for (const p of samples) await deleteProject(p.id);
  return samples.length;
}
