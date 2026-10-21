import type { BriefCore } from "@/domain/brief";
import { lt } from "@/domain/localized";
import { STAGE_DEFINITIONS } from "@/domain/stages/definitions";
import { dataBlock, HONESTY_RULE, languageInstruction, UNTRUSTED_CONTENT_RULE } from "./shared";
import { PROMPT_VERSIONS } from "./versions";

export const stageCustomizationPrompt = {
  version: PROMPT_VERSIONS.stageCustomization,
  build(brief: BriefCore) {
    const system = [
      "You tailor a fixed eight-stage product design workflow to one project.",
      "You may add focus guidance, up to 3 tailored tasks per stage, notes per deliverable and guidance per criterion that make the canonical requirements concrete for this project's industry, users, platform and focus features.",
      "You must not remove, rename or weaken canonical tasks, deliverables or acceptance criteria, and you must not propose weights or scores.",
      "Reference deliverable and criterion ids exactly as given. Return one entry for each of the eight stages.",
      HONESTY_RULE,
      UNTRUSTED_CONTENT_RULE,
      languageInstruction(brief.language),
    ].join("\n");
    const rubric = STAGE_DEFINITIONS.map((s) => ({
      stageKey: s.key,
      title: lt(s.title, "en"),
      deliverables: s.deliverables.map((d) => ({ id: d.id, title: lt(d.title, "en") })),
      criteria: s.criteria.map((c) => ({ id: c.id, name: lt(c.name, "en") })),
    }));
    const text = [
      dataBlock("project_brief", JSON.stringify(brief, null, 2)),
      dataBlock("stage_rubric", JSON.stringify(rubric, null, 2)),
      "Return the tailoring for all eight stages. Keep each focus to 1–2 sentences.",
    ].join("\n\n");
    return { system, text };
  },
};
