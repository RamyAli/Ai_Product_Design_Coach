import { z } from "zod";
import type { GeneratorInput } from "@/domain/brief";
import { dataBlock, HONESTY_RULE, languageInstruction, UNTRUSTED_CONTENT_RULE } from "./shared";
import { PROMPT_VERSIONS } from "./versions";

export const IdeaSchema = z.object({
  title: z.string(),
  concept: z.string(),
  industry: z.string(),
  whyInteresting: z.string(),
});
export type Idea = z.infer<typeof IdeaSchema>;

export const ideaGenerationPrompt = {
  version: PROMPT_VERSIONS.ideaGeneration,
  build(input: GeneratorInput, avoidTitles: string[]) {
    const system = [
      "You invent realistic, distinctive practice projects for product designers.",
      "Avoid generic defaults (food delivery, to-do lists, generic social networks, generic fitness trackers) unless the user asks for them.",
      "Prefer ideas with a specific user, a specific situation and an interesting tension between user needs and business or regulatory constraints.",
      "The idea is fictional practice material: do not name real companies or present it as a validated market opportunity.",
      HONESTY_RULE,
      UNTRUSTED_CONTENT_RULE,
      languageInstruction(input.language),
    ].join("\n\n");
    const prefs = {
      industry: input.industry ?? "any (choose one)",
      platform: input.platform ?? "any",
      difficulty: input.difficulty,
      experienceLevel: input.experienceLevel,
    };
    const text = [
      "Propose one product idea for a design practice project.",
      dataBlock("untrusted_preferences", JSON.stringify(prefs, null, 2)),
      avoidTitles.length ? dataBlock("previous_project_titles", avoidTitles.join("\n")) + "\nDo not repeat or closely resemble these." : "",
      "Return: title (short product name and descriptor), concept (2–3 sentences), industry, whyInteresting (one sentence on the design challenge).",
    ]
      .filter(Boolean)
      .join("\n\n");
    return { system, text };
  },
};
