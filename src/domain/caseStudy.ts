import { z } from "zod";
import type { Decision, Locale, StageKey } from "./enums";
import type { LocalizedText } from "./localized";

export const CASE_STUDY_MIN_COMPLETED_STAGES = 4;

export interface CaseStudySectionDef {
  id: string;
  title: LocalizedText;
  sourceStages: StageKey[];
  /** Sections that may be written from the brief alone */
  briefOnly?: boolean;
}

export const CASE_STUDY_SECTIONS: CaseStudySectionDef[] = [
  { id: "overview", title: { en: "Overview", ar: "نظرة عامة" }, sourceStages: [], briefOnly: true },
  { id: "problem", title: { en: "Problem and opportunity", ar: "المشكلة والفرصة" }, sourceStages: ["discovery"] },
  { id: "context", title: { en: "Context and constraints", ar: "السياق والقيود" }, sourceStages: [], briefOnly: true },
  { id: "research", title: { en: "Research and findings", ar: "البحث والنتائج" }, sourceStages: ["research"] },
  { id: "personas", title: { en: "Personas or user needs", ar: "الشخصيات أو احتياجات المستخدم" }, sourceStages: ["research"] },
  { id: "flows_ia", title: { en: "User flows and information architecture", ar: "تدفقات المستخدم وبنية المعلومات" }, sourceStages: ["architecture"] },
  { id: "wireframes", title: { en: "Wireframes and design exploration", ar: "النماذج التخطيطية واستكشاف التصميم" }, sourceStages: ["wireframes"] },
  { id: "final_design", title: { en: "Final design and prototype", ar: "التصميم النهائي والنموذج التفاعلي" }, sourceStages: ["visual_design", "prototype"] },
  { id: "validation", title: { en: "Validation and iteration", ar: "التحقق والتكرار" }, sourceStages: ["usability_testing"] },
  { id: "outcomes", title: { en: "Outcomes and reflection", ar: "النتائج والتأمل" }, sourceStages: ["handoff"] },
];

export interface CaseStudyEvidence {
  stageKey: StageKey;
  stageTitle: string;
  versionNumber: number;
  stageCompleted: boolean;
  decision: Decision | null;
  score: number | null;
  isMockReview: boolean;
  excerpt: string;
  reviewSummary: string;
  assetLabels: string[];
}

export interface CaseStudyOutlineSection {
  id: string;
  title: string;
  supported: boolean;
  briefFacts: string[];
  evidence: CaseStudyEvidence[];
  missingReason: string | null;
}

export interface CaseStudyOutline {
  projectTitle: string;
  language: Locale;
  sections: CaseStudyOutlineSection[];
}

export const CaseStudyDraftSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      body: z.string(),
      missingEvidence: z.array(z.string()),
    }),
  ),
});
export type CaseStudyDraft = z.infer<typeof CaseStudyDraftSchema>;

export function renderCaseStudyMarkdown(outline: CaseStudyOutline, draft: CaseStudyDraft, generatedAt: Date): string {
  const L = outline.language;
  const bodies = new Map(draft.sections.map((s) => [s.id, s]));
  const lines: string[] = [`# ${outline.projectTitle}`, ""];
  lines.push(
    L === "ar"
      ? `> مسودة أُنشئت من أدلة المشروع المحفوظة بتاريخ ${generatedAt.toISOString().slice(0, 10)}. الأقسام الموسومة «أدلة ناقصة» تحتاج إلى مساهمتك. لا تضف نتائج أو مؤشرات لم تحدث فعلاً.`
      : `> Draft generated from saved project evidence on ${generatedAt.toISOString().slice(0, 10)}. Sections marked "Missing evidence" need your input. Do not add results or metrics that did not actually happen.`,
    "",
  );
  outline.sections.forEach((section, index) => {
    lines.push(`## ${index + 1}. ${section.title}`, "");
    const body = bodies.get(section.id);
    if (section.supported && body?.body.trim()) lines.push(body.body.trim(), "");
    const missing = [...(section.missingReason ? [section.missingReason] : []), ...(body?.missingEvidence ?? [])];
    for (const m of missing) lines.push(`> **${L === "ar" ? "أدلة ناقصة" : "Missing evidence"}:** ${m}`, "");
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
