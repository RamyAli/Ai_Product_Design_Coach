import type { AIUsage } from "./types";

/** USD per million tokens (input, output). Estimates only; shown to users as such. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 10_000) / 10_000;
}

export function hasKnownPrice(model: string): boolean {
  return model in PRICES;
}

export function addUsage(a: AIUsage | null, b: AIUsage | null): AIUsage | null {
  if (!a) return b;
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: (a.cacheReadTokens ?? 0) + (b.cacheReadTokens ?? 0),
    estimatedCostUsd:
      a.estimatedCostUsd === null || b.estimatedCostUsd === null ? null : a.estimatedCostUsd + b.estimatedCostUsd,
  };
}

/** Rough pre-flight token estimate: ~4 characters per token for text, flat cost per image/PDF page. */
export function estimateRequestTokens(params: { textChars: number; images: number; pdfPages: number; outputTokens: number }) {
  const input = Math.ceil(params.textChars / 4) + params.images * 1600 + params.pdfPages * 1800 + 3000;
  return { inputTokens: input, outputTokens: params.outputTokens };
}
