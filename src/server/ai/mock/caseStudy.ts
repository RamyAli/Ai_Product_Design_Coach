import type { CaseStudyDraft, CaseStudyOutline } from "@/domain/caseStudy";

function quote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => `> ${l}`)
    .join("\n");
}

/** Assembles a draft only from the user's own saved words and review summaries. */
export function mockCaseStudy(language: "en" | "ar", outlineUnknown: unknown): CaseStudyDraft {
  const outline = outlineUnknown as CaseStudyOutline;
  const ar = language === "ar";
  return {
    sections: outline.sections.map((s) => {
      if (!s.supported) return { id: s.id, body: "", missingEvidence: [] };
      const parts: string[] = [];
      if (s.briefFacts.length) parts.push(s.briefFacts.map((f) => `- ${f}`).join("\n"));
      for (const e of s.evidence) {
        parts.push(
          ar
            ? `**${e.stageTitle}** — النسخة ${e.versionNumber}${e.decision ? ` (قرار المراجعة: ${e.decision}${e.isMockReview ? "، مراجعة تجريبية" : ""})` : ""}`
            : `**${e.stageTitle}** — version ${e.versionNumber}${e.decision ? ` (review decision: ${e.decision}${e.isMockReview ? ", demo review" : ""})` : ""}`,
        );
        if (e.excerpt.trim()) parts.push(quote(e.excerpt.trim()));
        if (e.assetLabels.length) parts.push((ar ? "المرفقات: " : "Attachments: ") + e.assetLabels.join(", "));
      }
      parts.push(ar ? "_أعد صياغة هذا القسم بأسلوبك الخاص قبل النشر._" : "_Rewrite this section in your own voice before publishing._");
      return { id: s.id, body: parts.join("\n\n"), missingEvidence: [] };
    }),
  };
}
