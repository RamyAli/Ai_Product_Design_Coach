import type { CaseStudyOutline } from "@/domain/caseStudy";
import { dataBlock, HONESTY_RULE, languageInstruction, UNTRUSTED_CONTENT_RULE } from "./shared";
import { PROMPT_VERSIONS } from "./versions";

export const caseStudyPrompt = {
  version: PROMPT_VERSIONS.caseStudy,
  build(outline: CaseStudyOutline) {
    const system = [
      "You help a product designer draft an honest portfolio case study from their saved project evidence.",
      "Write only what the evidence supports. Every claim must trace to a brief fact, a submission excerpt or a review summary in the outline.",
      "Never invent research findings, participant quotes, usability metrics, conversion improvements, business results or shipped outcomes. If the project was a fictional practice brief, do not present it as a real client engagement.",
      "Write in first person as the designer, plainly and specifically. Where evidence is thin, list what is missing in missingEvidence instead of filling the gap.",
      "Return one entry per section id in the outline. For sections with supported=false, return an empty body.",
      HONESTY_RULE,
      UNTRUSTED_CONTENT_RULE,
      languageInstruction(outline.language),
    ].join("\n");
    const text = dataBlock("case_study_outline", JSON.stringify(outline, null, 2));
    return { system, text };
  },
};
