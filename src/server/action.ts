import { ZodError } from "zod";
import { AIError } from "./ai/errors";
import { AppError } from "./errors";
import { IngestionError } from "./ingestion/errors";

export interface ActionError {
  code: string;
  message: string;
  details?: unknown;
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

/** Converts thrown errors into safe, serialisable results. Never leaks stack traces, paths or keys. */
export function toActionError(err: unknown): ActionError {
  if (err instanceof AppError) return { code: err.code, message: err.message, details: err.details };
  if (err instanceof IngestionError) return { code: err.code, message: err.message, details: err.params };
  if (err instanceof AIError) return { code: `ai_${err.code}`, message: err.message };
  if (err instanceof ZodError) {
    return {
      code: "validation",
      message: "Some fields are invalid.",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  console.error("[action] unexpected error", err);
  return { code: "internal", message: "Something went wrong. Your saved work is unaffected; please try again." };
}

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return { ok: false, error: toActionError(err) };
  }
}
