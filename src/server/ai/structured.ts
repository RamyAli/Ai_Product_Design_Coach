import type { z } from "zod";
import { AI_ERROR_MESSAGES, AIError } from "./errors";
import { addUsage } from "./pricing";
import type { AIResult, AIUsage, ProviderId } from "./types";

export const MAX_STRUCTURED_ATTEMPTS = 3;

/** Extracts a JSON object from model text, tolerating code fences or leading prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new SyntaxError("No JSON object found in response");
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

/**
 * Calls the model, parses and validates the response, and on malformed output retries with
 * a corrective message describing the problems. Transient transport errors are retried once.
 */
export async function runStructuredWithRecovery<T>(params: {
  provider: ProviderId;
  model: string;
  schema: z.ZodType<T>;
  validate?: (data: T) => string[];
  call: (correction: string | null) => Promise<{ text: string; usage: AIUsage | null; model: string }>;
  maxAttempts?: number;
}): Promise<AIResult<T>> {
  const maxAttempts = params.maxAttempts ?? MAX_STRUCTURED_ATTEMPTS;
  let usage: AIUsage | null = null;
  let correction: string | null = null;
  let lastProblems: string[] = [];
  let transientRetried = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: { text: string; usage: AIUsage | null; model: string };
    try {
      response = await params.call(correction);
    } catch (err) {
      const e = err instanceof AIError ? err : new AIError("unknown", AI_ERROR_MESSAGES.unknown, String(err));
      if (e.code === "truncated" || (e.retryable && !transientRetried && e.code !== "malformed_output")) {
        transientRetried = true;
        correction = e.code === "truncated" ? "Your previous answer was cut off. Be more concise and return the complete JSON object." : correction;
        continue;
      }
      throw e;
    }
    usage = addUsage(usage, response.usage);

    let json: unknown;
    try {
      json = extractJson(response.text);
    } catch {
      lastProblems = ["Response was not valid JSON."];
      correction = "Your previous response was not valid JSON. Return only the JSON object that matches the required schema.";
      continue;
    }
    const parsed = params.schema.safeParse(json);
    if (!parsed.success) {
      lastProblems = formatZodIssues(parsed.error);
      correction = `Your previous response did not match the required schema:\n- ${lastProblems.join("\n- ")}\nReturn the complete, corrected JSON object.`;
      continue;
    }
    const problems = params.validate?.(parsed.data) ?? [];
    if (problems.length > 0) {
      lastProblems = problems;
      correction = `Your previous response violated these rules:\n- ${problems.join("\n- ")}\nReturn the complete, corrected JSON object.`;
      continue;
    }
    return { data: parsed.data, provider: params.provider, model: response.model, usage, attempts: attempt };
  }
  throw new AIError("malformed_output", AI_ERROR_MESSAGES.malformed_output, lastProblems.join("; "));
}
