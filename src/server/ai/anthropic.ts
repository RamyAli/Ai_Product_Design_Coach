import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { LIMITS } from "../config";
import { AI_ERROR_MESSAGES, AIError } from "./errors";
import { estimateCostUsd } from "./pricing";
import { runStructuredWithRecovery } from "./structured";
import type {
  AIProvider,
  AIResult,
  AIUsage,
  ContentPart,
  ProviderCapabilities,
  StructuredRequest,
  TextRequest,
} from "./types";

type Effort = "low" | "medium" | "high" | "xhigh";

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  effort: Effort;
  /** Server-side refusal fallback (opt-in beta). Safe on models without fallback support. */
  enableFallbacks?: boolean;
}

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function toBlocks(parts: ContentPart[]): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      if (part.text.trim()) blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image") {
      blocks.push({ type: "text", text: `[${part.label}]` });
      blocks.push({ type: "image", source: { type: "base64", media_type: part.mediaType, data: part.dataBase64 } });
    } else {
      blocks.push({
        type: "document",
        title: part.label,
        source: { type: "base64", media_type: "application/pdf", data: part.dataBase64 },
      });
    }
  }
  return blocks;
}

/** Maps SDK exceptions (most specific first) to provider-agnostic errors with safe messages. */
export function mapAnthropicError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  const detail = err instanceof Error ? err.message : String(err);
  if (err instanceof Anthropic.APIUserAbortError) return new AIError("cancelled", AI_ERROR_MESSAGES.cancelled, detail);
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new AIError("timeout", AI_ERROR_MESSAGES.timeout, detail);
  if (err instanceof Anthropic.APIConnectionError) return new AIError("network", AI_ERROR_MESSAGES.network, detail);
  if (err instanceof Anthropic.AuthenticationError) return new AIError("authentication", AI_ERROR_MESSAGES.authentication, detail);
  if (err instanceof Anthropic.PermissionDeniedError) return new AIError("permission", AI_ERROR_MESSAGES.permission, detail);
  if (err instanceof Anthropic.NotFoundError)
    return new AIError("invalid_request", "The configured model was not found. Check the model name in Settings.", detail);
  if (err instanceof Anthropic.RateLimitError) return new AIError("rate_limited", AI_ERROR_MESSAGES.rate_limited, detail);
  if (err instanceof Anthropic.BadRequestError) {
    if (/too long|too many tokens|context/i.test(detail)) return new AIError("context_too_large", AI_ERROR_MESSAGES.context_too_large, detail);
    return new AIError("invalid_request", AI_ERROR_MESSAGES.invalid_request, detail);
  }
  if (err instanceof Anthropic.InternalServerError) return new AIError("overloaded", AI_ERROR_MESSAGES.overloaded, detail);
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new AIError("overloaded", AI_ERROR_MESSAGES.overloaded, detail);
    return new AIError("unknown", AI_ERROR_MESSAGES.unknown, detail);
  }
  return new AIError("unknown", AI_ERROR_MESSAGES.unknown, detail);
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  readonly isMock = false;
  readonly model: string;
  readonly capabilities: ProviderCapabilities = {
    vision: true,
    pdf: true,
    structuredOutput: true,
    maxImageBytes: 5 * 1024 * 1024,
    maxPdfBytes: 30 * 1024 * 1024,
  };
  private readonly client: Anthropic;
  private readonly effort: Effort;
  private readonly enableFallbacks: boolean;

  constructor(opts: AnthropicProviderOptions) {
    this.model = opts.model;
    this.effort = opts.effort;
    this.enableFallbacks = opts.enableFallbacks ?? true;
    this.client = new Anthropic({ apiKey: opts.apiKey, timeout: LIMITS.aiRequestTimeoutMs, maxRetries: 2 });
  }

  private usageOf(message: Anthropic.Beta.BetaMessage): AIUsage {
    const input = message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0);
    const output = message.usage.output_tokens;
    return {
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      estimatedCostUsd: estimateCostUsd(this.model, input + (message.usage.cache_read_input_tokens ?? 0) * 0.1, output),
    };
  }

  private async send(params: {
    system: string;
    messages: Anthropic.Beta.BetaMessageParam[];
    maxTokens: number;
    signal?: AbortSignal;
    format?: ReturnType<typeof zodOutputFormat>;
  }): Promise<{ text: string; usage: AIUsage; model: string }> {
    try {
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: params.maxTokens,
          system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
          messages: params.messages,
          output_config: params.format ? { effort: this.effort, format: params.format } : { effort: this.effort },
          ...(this.enableFallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
        },
        { signal: params.signal },
      );
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        throw new AIError("refusal", AI_ERROR_MESSAGES.refusal, message.stop_details?.category ?? undefined);
      }
      if (message.stop_reason === "max_tokens") {
        throw new AIError("truncated", AI_ERROR_MESSAGES.truncated);
      }
      const text = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { text, usage: this.usageOf(message), model: message.model };
    } catch (err) {
      throw mapAnthropicError(err);
    }
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<AIResult<T>> {
    const format = zodOutputFormat(req.schema as unknown as z.ZodType);
    return runStructuredWithRecovery<T>({
      provider: this.id,
      model: this.model,
      schema: req.schema,
      validate: req.validate,
      call: async (correction) => {
        const content = toBlocks(req.content);
        if (correction) content.push({ type: "text", text: correction });
        return this.send({
          system: req.system,
          messages: [{ role: "user", content }],
          maxTokens: req.maxTokens,
          signal: req.signal,
          format,
        });
      },
    });
  }

  async generateText(req: TextRequest): Promise<AIResult<string>> {
    const messages: Anthropic.Beta.BetaMessageParam[] = req.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : toBlocks(m.content),
    }));
    const result = await this.send({ system: req.system, messages, maxTokens: req.maxTokens, signal: req.signal });
    return { data: result.text.trim(), provider: this.id, model: result.model, usage: result.usage, attempts: 1 };
  }

  async testConnection(): Promise<{ ok: true; detail: string }> {
    try {
      const info = await this.client.models.retrieve(this.model);
      return { ok: true, detail: info.display_name ?? info.id };
    } catch (err) {
      throw mapAnthropicError(err);
    }
  }
}
