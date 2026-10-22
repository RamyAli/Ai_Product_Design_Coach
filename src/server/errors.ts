export type AppErrorCode =
  | "not_found"
  | "validation"
  | "conflict"
  | "forbidden_state"
  | "gate_blocked"
  | "upload_rejected"
  | "ai_error"
  | "internal";

/** Error with a message that is safe to show to the user. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;
  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function notFound(what: string): AppError {
  return new AppError("not_found", `${what} not found.`);
}
