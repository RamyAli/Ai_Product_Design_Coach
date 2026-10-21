import type { BriefCore, StagePlan } from "@/domain/brief";
import type { Difficulty, Locale, Strictness } from "@/domain/enums";
import { lt } from "@/domain/localized";
import type { StageRubric } from "@/domain/scoring";
import type { StageDefinition } from "@/domain/stages/types";
import type { ContentPart } from "../types";
import { revisionComparisonPrompt, type PreviousReviewContext } from "./revisionComparison";
import { dataBlock, HONESTY_RULE, languageInstruction, UNTRUSTED_CONTENT_RULE } from "./shared";
import { PROMPT_VERSIONS } from "./versions";

export interface EvaluationEvidenceBlock {
  ref: string;
  kind: "text" | "notes" | "pdf" | "image" | "figma";
  label: string;
  /** Text content (for text/notes/pdf text/figma metadata); empty for pure images */
  text: string;
  available: boolean;
  detail?: string;
}

export interface EvaluationPromptInput {
  language: Locale;
  strictness: Strictness;
  difficulty: Difficulty;
  brief: BriefCore;
  stage: StageDefinition;
  rubric: StageRubric;
  customization: StagePlan | null;
  evidence: EvaluationEvidenceBlock[];
  /** Images and PDFs to attach (already capability-checked and size-limited) */
  attachments: ContentPart[];
  previous: PreviousReviewContext | null;
}

const STRICTNESS_GUIDANCE: Record<Strictness, string> = {
  supportive:
    "Tone: supportive and encouraging, but do not lower the bar. Every acceptance criterion and scoring rule still applies exactly.",
  standard: "Tone: direct, constructive senior-designer feedback.",
  demanding:
    "Tone: demanding, as for a senior portfolio review. Probe weak reasoning hard. Every acceptance criterion and scoring rule still applies exactly.",
};

export const evaluationPrompt = {
  version: PROMPT_VERSIONS.submissionEvaluation,
  /** Combined version string stored on the review */
  fullVersion(hasPrevious: boolean) {
    return hasPrevious ? `${PROMPT_VERSIONS.submissionEvaluation}+${PROMPT_VERSIONS.revisionComparison}` : PROMPT_VERSIONS.submissionEvaluation;
  },
  build(input: EvaluationPromptInput): { system: string; content: ContentPart[] } {
    const system = [
      "You are a rigorous, fair and constructive senior product designer reviewing one stage of a practice design project.",
      "You coach the designer: identify gaps and explain how to improve. Do not do the work for them and do not rewrite their deliverables.",
      "",
      "Evaluation rules:",
      "1. Score each rubric criterion from 0 to 100 using only the evidence provided. Apply the criteria consistently.",
      "2. Status per criterion: met (fully satisfied), partial, not_met (supplied but poor), missing (the artifact was not supplied — merely mentioning it is not supplying it), not_evaluable (the evidence exists but you cannot access or read it, e.g. an inaccessible link or unreadable file).",
      "3. Distinguish missing evidence from poor-quality evidence. Do not penalise a format that is not required. Do not penalise the same underlying problem under several criteria — attribute it to the most relevant one.",
      "4. Cite evidence using the manifest refs (e.g. T1, A2, I1) with a locator such as a heading or page (\"p.3\"). Quotes must be copied exactly from the text. Never cite refs, pages or content that do not exist. If you cannot locate evidence, say so.",
      "5. For images, assess only what is visible. A Figma or prototype URL without accessible content is not evidence of the design or that a prototype works.",
      "6. Judge design quality, not presentation polish, and never justify criticism with personal taste alone — explain the usability, accessibility, consistency or business rationale.",
      "7. Do not reward unsupported claims. Claimed research or test results without supporting material must be treated as unverified.",
      "8. Every issue must state what you observed, why it matters to users or the business, and a specific improvement. Use severities critical, major, minor, suggestion. Critical = blocks the stage objective or a mandatory deliverable is missing.",
      "9. Revision tasks must be concrete actions the designer can take, each linked to an issue id and criterion id. Prefer 3–7 tasks.",
      "10. confidence (0–100) is how much of the required work you could reliably evaluate — not how good it is. Lower it for unreadable files, inaccessible links, partial screenshots or missing context, and explain why in limitations.",
      "11. Do not compute an overall score or a pass/fail decision. The application calculates these deterministically from your criterion scores.",
      HONESTY_RULE,
      UNTRUSTED_CONTENT_RULE,
      STRICTNESS_GUIDANCE[input.strictness],
      languageInstruction(input.language),
    ].join("\n");

    const stageSpec = {
      stageKey: input.stage.key,
      title: lt(input.stage.title, "en"),
      objective: lt(input.stage.objective, "en"),
      expectedDepth: lt(input.stage.depthGuidance[input.difficulty], "en"),
      projectFocus: input.customization?.focus ?? null,
    };
    const rubric = {
      deliverables: input.rubric.deliverables.map((d) => ({
        id: d.id,
        title: lt(d.title, "en"),
        description: lt(d.description, "en"),
        mandatory: d.mandatory,
        evidenceNeeded: d.evidence,
        projectNote: input.customization?.deliverableNotes.find((n) => n.deliverableId === d.id)?.note ?? null,
      })),
      criteria: input.rubric.criteria.map((c) => ({
        id: c.id,
        name: lt(c.name, "en"),
        description: lt(c.description, "en"),
        mandatory: c.mandatory,
        evidenceNeeded: c.evidence,
        relatedDeliverables: c.deliverableIds,
        projectGuidance: input.customization?.criteriaGuidance.find((g) => g.criterionId === c.id)?.guidance ?? null,
      })),
    };
    const briefSummary = {
      title: input.brief.title,
      summary: input.brief.summary,
      problemStatement: input.brief.problemStatement,
      targetUsers: input.brief.targetUsers,
      platform: input.brief.platform,
      focusFeatures: input.brief.focusFeatures.map((f) => ({ name: f.name, description: f.description })),
      businessObjectives: input.brief.businessObjectives,
      constraints: input.brief.constraints,
      language: input.brief.language,
    };
    const manifest = input.evidence.map((e) => ({ ref: e.ref, kind: e.kind, label: e.label, available: e.available, note: e.detail ?? null }));

    const parts: ContentPart[] = [];
    parts.push({
      type: "text",
      text: [
        dataBlock("project_brief", JSON.stringify(briefSummary, null, 2)),
        dataBlock("stage_spec", JSON.stringify(stageSpec, null, 2)),
        dataBlock("stage_rubric", JSON.stringify(rubric, null, 2)),
        dataBlock("evidence_manifest", JSON.stringify(manifest, null, 2)),
      ].join("\n\n"),
    });
    for (const e of input.evidence) {
      if (!e.text.trim()) continue;
      parts.push({ type: "text", text: dataBlock("evidence", e.text, { ref: e.ref, kind: e.kind, label: e.label }) });
    }
    parts.push(...input.attachments);
    const closing = [
      input.previous ? revisionComparisonPrompt.build(input.previous) : "There is no previous review for this stage; return an empty previousTaskAssessments array.",
      "Now evaluate the submission against every criterion and deliverable in the rubric (each exactly once) and return the JSON object.",
    ];
    parts.push({ type: "text", text: closing.join("\n\n") });
    return { system, content: parts };
  },
};
