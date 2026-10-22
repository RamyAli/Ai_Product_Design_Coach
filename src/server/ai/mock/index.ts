import { lt } from "@/domain/localized";
import { AI_ERROR_MESSAGES, AIError } from "../errors";
import type { AIProvider, AIResult, AITask, ProviderCapabilities, StructuredRequest, TextRequest } from "../types";
import { mockEvaluate } from "./evaluate";
import { buildMockBrief, buildMockCustomization, pickSampleIdea } from "./generate";
import { mockCaseStudy } from "./caseStudy";

export const MOCK_MODEL = "offline-demo-v1";

/**
 * Deterministic offline provider for tests, development and exploring the app without an
 * API key. Every result it produces is stored with isMock = true and labelled in the UI.
 */
export class MockProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly isMock = true;
  readonly model = MOCK_MODEL;
  readonly capabilities: ProviderCapabilities = {
    vision: false,
    pdf: false,
    structuredOutput: true,
    maxImageBytes: 5 * 1024 * 1024,
    maxPdfBytes: 30 * 1024 * 1024,
  };

  /** Test hook: force the next N calls to fail with the given error code. */
  static failNext: { code: AIError["code"]; remaining: number } | null = null;
  /** Test hook: return this raw value (instead of the generated one) for the next structured call. */
  static rawOverride: unknown[] = [];

  private maybeFail() {
    const f = MockProvider.failNext;
    if (f && f.remaining > 0) {
      f.remaining -= 1;
      if (f.remaining === 0) MockProvider.failNext = null;
      throw new AIError(f.code, AI_ERROR_MESSAGES[f.code]);
    }
  }

  private produce(task: AITask): unknown {
    switch (task.kind) {
      case "generate_idea": {
        const idea = pickSampleIdea(task.input, task.avoidTitles);
        return { title: lt(idea.title, task.input.language), concept: lt(idea.concept, task.input.language), industry: idea.industry, whyInteresting: "" };
      }
      case "generate_brief": {
        const idea = pickSampleIdea(task.input, task.avoidTitles);
        return buildMockBrief(task.input, idea);
      }
      case "customize_stages":
        return buildMockCustomization(task.brief);
      case "evaluate_submission":
        return mockEvaluate(task.context);
      case "case_study":
        return mockCaseStudy(task.language, task.outline);
      case "follow_up":
        return null;
    }
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<AIResult<T>> {
    this.maybeFail();
    if (req.signal?.aborted) throw new AIError("cancelled", AI_ERROR_MESSAGES.cancelled);
    let attempts = 0;
    const candidates = [...MockProvider.rawOverride.splice(0), this.produce(req.task)];
    for (const raw of candidates) {
      attempts++;
      const parsed = req.schema.safeParse(raw);
      if (!parsed.success) continue;
      const problems = req.validate?.(parsed.data) ?? [];
      if (problems.length) continue;
      return { data: parsed.data, provider: this.id, model: this.model, usage: null, attempts };
    }
    throw new AIError("malformed_output", AI_ERROR_MESSAGES.malformed_output, "mock output failed validation");
  }

  async generateText(req: TextRequest): Promise<AIResult<string>> {
    this.maybeFail();
    const task = req.task;
    const ar = task.kind === "follow_up" && task.language === "ar";
    const text = ar
      ? "هذا رد تجريبي من المرشد غير المتصل، وليس إجابة من ذكاء اصطناعي. لإجابات مخصصة، أضف مفتاح API في الإعدادات.\n\nنصائح عامة لهذه المرحلة:\n- اربط كل قرار بدليل أو افتراض موسوم بوضوح.\n- راجع معايير القبول واحدة تلو الأخرى قبل الإرسال.\n- ابدأ بالمهام ذات الشدة الحرجة في آخر مراجعة."
      : "This is a demo reply from the offline mentor, not an AI answer. Add an API key in Settings for tailored guidance.\n\nGeneral guidance for this stage:\n- Tie each decision to evidence, or label it clearly as an assumption.\n- Walk through the acceptance criteria one by one before submitting.\n- Start with the critical-severity tasks from your latest review.";
    return { data: text, provider: this.id, model: this.model, usage: null, attempts: 1 };
  }

  async testConnection(): Promise<{ ok: true; detail: string }> {
    return { ok: true, detail: "Offline demo provider" };
  }
}
