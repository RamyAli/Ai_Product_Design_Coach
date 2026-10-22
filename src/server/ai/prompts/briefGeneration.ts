import type { GeneratorInput } from "@/domain/brief";
import type { Idea } from "./ideaGeneration";
import { dataBlock, HONESTY_RULE, languageInstruction, UNTRUSTED_CONTENT_RULE } from "./shared";
import { PROMPT_VERSIONS } from "./versions";

export const briefGenerationPrompt = {
  version: PROMPT_VERSIONS.briefGeneration,
  build(input: GeneratorInput, idea: Idea | null, avoidTitles: string[]) {
    const system = [
      "You are a senior product design lead writing a realistic project brief for a designer who wants deliberate practice.",
      "Rules:",
      "1. The idea must be coherent and feasible for the stated platform and difficulty.",
      "2. Provide exactly 2–4 focus features. They must be distinct but related, and together form one coherent product slice. Avoid feature overload.",
      "3. Adapt requirements, constraints and edge cases to the industry (e.g. regulation, privacy, accessibility, trust).",
      "4. Include realistic constraints and edge cases that force trade-offs.",
      "5. Success metrics must be measurable. Do not invent baseline numbers; targets may be proposed but must be labelled as targets.",
      "6. This is a fictional practice brief. Do not imply it represents a real company or a validated market opportunity. Assumptions must be phrased as assumptions.",
      "7. Scale depth to experience level and difficulty: beginners get tighter scope; advanced/hard briefs get more ambiguity, stakeholders and constraints.",
      "8. The problemStatement is a starting framing; the designer will refine it in Stage 1. Do not prescribe a solution in it.",
      HONESTY_RULE,
      UNTRUSTED_CONTENT_RULE,
      languageInstruction(input.language),
    ].join("\n");
    const requested = {
      mode: input.mode,
      concept: input.concept ?? null,
      industry: input.industry ?? null,
      problemArea: input.problemArea ?? null,
      targetAudience: input.targetAudience ?? null,
      market: input.market ?? null,
      platform: input.platform ?? null,
      experienceLevel: input.experienceLevel,
      difficulty: input.difficulty,
      duration: input.duration ?? null,
      focusFeatures: input.focusFeatures,
      constraints: input.constraints ?? null,
      portfolioOrientation: input.portfolioOrientation ?? null,
      language: input.language,
    };
    const text = [
      "Write the project brief.",
      dataBlock("untrusted_user_request", JSON.stringify(requested, null, 2)),
      idea ? dataBlock("selected_idea", JSON.stringify(idea, null, 2)) : "",
      avoidTitles.length ? dataBlock("previous_project_titles", avoidTitles.join("\n")) + "\nAvoid repeating these ideas." : "",
      "Honour every non-null field the user supplied. Fill unspecified fields with sensible choices. If the user listed focus features, keep them (normalise wording) and only add one if fewer than 2 were given. Set platform, experienceLevel, difficulty and language to the requested values when supplied.",
      "Field guidance: summary = 2–3 sentence description; problemContext = situation today; businessOpportunity = why it matters to the business; targetUsers = 1–3 segments with needs; focusFeatures ids = short snake_case; inScope/outOfScope = concrete items; estimatedEffort = rough hours; challengeRationale = why this is a useful design challenge.",
    ]
      .filter(Boolean)
      .join("\n\n");
    return { system, text };
  },
};
