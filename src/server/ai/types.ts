import type { z } from "zod";
import type { GeneratorInput, BriefCore } from "@/domain/brief";
import type { Locale, Strictness } from "@/domain/enums";
import type { StageRubric } from "@/domain/scoring";

export type ProviderId = "anthropic" | "mock";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string; label: string }
  | { type: "pdf"; dataBase64: string; label: string };

export interface ProviderCapabilities {
  vision: boolean;
  pdf: boolean;
  structuredOutput: boolean;
  maxImageBytes: number;
  maxPdfBytes: number;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  /** Estimated from a static price table; null when the model's price is unknown */
  estimatedCostUsd: number | null;
}

export interface AIResult<T> {
  data: T;
  provider: ProviderId;
  model: string;
  usage: AIUsage | null;
  attempts: number;
}

// ---- Task descriptors: tell the provider *what* is being produced. The mock provider
// uses them to build deterministic output; real providers rely on the prompt. ----

export interface MockEvidenceText {
  ref: string;
  label: string;
  text: string;
}

export interface EvaluationTaskContext {
  rubric: StageRubric;
  stageKey: string;
  language: Locale;
  strictness: Strictness;
  texts: MockEvidenceText[];
  visualRefs: string[];
  unavailableVisualRefs: string[];
  previousTasks: { promptId: string; reviewTaskKey: string }[];
}

export type AITask =
  | { kind: "generate_idea"; input: GeneratorInput; avoidTitles: string[] }
  | { kind: "generate_brief"; input: GeneratorInput; idea: { title: string; concept: string; industry: string } | null; avoidTitles: string[] }
  | { kind: "customize_stages"; brief: BriefCore }
  | { kind: "evaluate_submission"; context: EvaluationTaskContext }
  | { kind: "follow_up"; language: Locale; question: string; stageTitle: string; hasReview: boolean }
  | { kind: "case_study"; language: Locale; outline: unknown };

export interface StructuredRequest<T> {
  task: AITask;
  system: string;
  content: ContentPart[];
  schema: z.ZodType<T>;
  maxTokens: number;
  signal?: AbortSignal;
  /** Extra domain checks; returned problems trigger one corrective retry */
  validate?: (data: T) => string[];
}

export interface TextMessage {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

export interface TextRequest {
  task: AITask;
  system: string;
  messages: TextMessage[];
  maxTokens: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly model: string;
  readonly isMock: boolean;
  readonly capabilities: ProviderCapabilities;
  generateStructured<T>(req: StructuredRequest<T>): Promise<AIResult<T>>;
  generateText(req: TextRequest): Promise<AIResult<string>>;
  testConnection(): Promise<{ ok: true; detail: string }>;
}
