export type AIErrorCode =
  | "not_configured"
  | "authentication"
  | "permission"
  | "rate_limited"
  | "overloaded"
  | "timeout"
  | "network"
  | "invalid_request"
  | "context_too_large"
  | "refusal"
  | "truncated"
  | "malformed_output"
  | "cancelled"
  | "unsupported_capability"
  | "unknown";

const RETRYABLE: ReadonlySet<AIErrorCode> = new Set(["rate_limited", "overloaded", "timeout", "network", "malformed_output", "truncated"]);

/** Provider-agnostic error with a message that is safe to show in the UI. */
export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  /** Internal diagnostic detail; logged server-side, never sent to the client */
  readonly detail?: string;

  constructor(code: AIErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
    this.detail = detail;
  }
}

export const AI_ERROR_MESSAGES: Record<AIErrorCode, string> = {
  not_configured: "No AI provider is configured. Add an API key in Settings or use mock mode.",
  authentication: "The AI provider rejected the API key. Check it in Settings.",
  permission: "The API key does not have access to the selected model.",
  rate_limited: "The AI provider is rate limiting requests. Please try again in a minute.",
  overloaded: "The AI provider is temporarily overloaded. Please try again shortly.",
  timeout: "The AI request took too long and was stopped. Your work is saved; try again.",
  network: "Could not reach the AI provider. Check your connection and try again.",
  invalid_request: "The AI provider rejected the request.",
  context_too_large: "This submission is too large to review in one request. Reduce attached files or text.",
  refusal: "The AI model declined this request.",
  truncated: "The AI response was cut off before it finished.",
  malformed_output: "The AI returned an invalid response after several attempts.",
  cancelled: "The request was cancelled.",
  unsupported_capability: "The selected model does not support this type of input.",
  unknown: "The AI request failed unexpectedly.",
};

export function toAIError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message))) {
    return new AIError("cancelled", AI_ERROR_MESSAGES.cancelled);
  }
  return new AIError("unknown", AI_ERROR_MESSAGES.unknown, err instanceof Error ? err.message : String(err));
}
