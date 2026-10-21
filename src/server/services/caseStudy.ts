import type { AiJob } from "@prisma/client";
import { CASE_STUDY_MIN_COMPLETED_STAGES, CASE_STUDY_SECTIONS, CaseStudyDraftSchema, renderCaseStudyMarkdown, type CaseStudyEvidence, type CaseStudyOutline } from "@/domain/caseStudy";
import type { Decision, Locale, StageKey } from "@/domain/enums";
import { lt } from "@/domain/localized";
import { getProvider } from "../ai";
import { caseStudyPrompt } from "../ai/prompts/caseStudy";
import { db, parseJson } from "../db";
import { AppError, notFound } from "../errors";
import { createJob, type JobOutcome } from "../jobs/queue";
import { readBrief, requireProject } from "./projects";

const EXCERPT_CHARS = 1_800;

export async function caseStudyAvailability(projectId: string) {
  const stages = await db.stage.findMany({ where: { projectId }, select: { status: true } });
  const completed = stages.filter((s) => s.status === "completed").length;
  return { completed, required: CASE_STUDY_MIN_COMPLETED_STAGES, available: completed >= CASE_STUDY_MIN_COMPLETED_STAGES };
}

/** Builds the outline strictly from saved data: brief facts, submitted work and formal reviews. */
export async function buildCaseStudyOutline(projectId: string): Promise<CaseStudyOutline> {
  const project = await requireProject(projectId);
  const brief = readBrief(project);
  const L = project.preferredLanguage as Locale;
  const stages = await db.stage.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    include: {
      submissions: { where: { status: "submitted" }, orderBy: { versionNumber: "desc" }, take: 1, include: { assets: true, reviews: { orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });
  const evidenceFor = (key: StageKey): CaseStudyEvidence | null => {
    const stage = stages.find((s) => s.stageKey === key);
    const sub = stage?.submissions[0];
    if (!stage || !sub) return null;
    const review = sub.reviews[0];
    return {
      stageKey: key,
      stageTitle: stage.title,
      versionNumber: sub.versionNumber ?? 0,
      stageCompleted: stage.status === "completed",
      decision: (review?.decision as Decision) ?? null,
      score: review?.overallScore ?? null,
      isMockReview: review?.isMock ?? false,
      excerpt: sub.textContent.slice(0, EXCERPT_CHARS) + (sub.textContent.length > EXCERPT_CHARS ? "\n…" : ""),
      reviewSummary: review?.summary ?? "",
      assetLabels: sub.assets.map((a) => a.originalFilename),
    };
  };
  const ar = L === "ar";
  const sections = CASE_STUDY_SECTIONS.map((def) => {
    const evidence = def.sourceStages.map(evidenceFor).filter((e): e is CaseStudyEvidence => e !== null);
    let briefFacts: string[] = [];
    if (def.id === "overview") briefFacts = [brief.summary, `${ar ? "المنصة" : "Platform"}: ${brief.platform}`, `${ar ? "الميزات المحورية" : "Focus features"}: ${brief.focusFeatures.map((f) => f.name).join(", ")}`, ar ? "مشروع تدريبي قائم على موجز خيالي." : "Practice project based on a fictional brief."];
    if (def.id === "problem") briefFacts = [brief.problemStatement, brief.businessOpportunity];
    if (def.id === "context") briefFacts = [...brief.constraints, ...brief.outOfScope.map((o) => `${ar ? "خارج النطاق" : "Out of scope"}: ${o}`)];
    const supported = def.briefOnly ? true : evidence.length > 0;
    const missingReason = supported
      ? null
      : ar
        ? `لا يوجد عمل مُرسل لمرحلة «${def.sourceStages.map((k) => stages.find((s) => s.stageKey === k)?.title ?? k).join("، ")}» بعد.`
        : `No submitted work for ${def.sourceStages.map((k) => stages.find((s) => s.stageKey === k)?.title ?? k).join(", ")} yet.`;
    return { id: def.id, title: lt(def.title, L), supported, briefFacts, evidence, missingReason };
  });
  return { projectTitle: project.title, language: L, sections };
}

export async function startCaseStudyDraft(projectId: string) {
  const availability = await caseStudyAvailability(projectId);
  if (!availability.available) {
    throw new AppError("gate_blocked", `Complete at least ${availability.required} stages before drafting a case study.`);
  }
  return createJob({ type: "case_study", input: { projectId }, projectId });
}

export async function runCaseStudyJob(job: AiJob, signal: AbortSignal): Promise<JobOutcome> {
  const { projectId } = parseJson<{ projectId: string }>(job.inputJson, { projectId: "" });
  const outline = await buildCaseStudyOutline(projectId);
  const provider = await getProvider();
  const prompt = caseStudyPrompt.build(outline);
  const result = await provider.generateStructured({
    task: { kind: "case_study", language: outline.language, outline },
    system: prompt.system,
    content: [{ type: "text", text: prompt.text }],
    schema: CaseStudyDraftSchema,
    maxTokens: 12_000,
    signal,
  });
  const now = new Date();
  const markdown = renderCaseStudyMarkdown(outline, result.data, now);
  await db.caseStudy.upsert({
    where: { projectId },
    create: { projectId, contentMarkdown: markdown, outlineJson: JSON.stringify(outline), source: provider.isMock ? "mock" : "ai", generatedAt: now },
    update: { contentMarkdown: markdown, outlineJson: JSON.stringify(outline), source: provider.isMock ? "mock" : "ai", generatedAt: now },
  });
  return { result: { projectId }, usage: result.usage, provider: result.provider, model: result.model };
}

export async function saveCaseStudy(projectId: string, markdown: string) {
  if (markdown.length > 200_000) throw new AppError("validation", "The case study is too long.");
  const existing = await db.caseStudy.findUnique({ where: { projectId } });
  if (!existing) {
    await requireProject(projectId);
    return db.caseStudy.create({ data: { projectId, contentMarkdown: markdown, outlineJson: "{}", source: "user" } });
  }
  return db.caseStudy.update({ where: { projectId }, data: { contentMarkdown: markdown, source: existing.source === "user" ? "user" : existing.source } });
}

export async function getCaseStudy(projectId: string) {
  const cs = await db.caseStudy.findUnique({ where: { projectId } });
  if (!cs) return null;
  return cs;
}

