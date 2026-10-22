import { NextResponse } from "next/server";
import { toActionError } from "./action";

/**
 * Rejects cross-site requests to mutating API routes. The app is single-user and local, so
 * any request carrying an Origin from another site is refused (CSRF protection).
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    // fall through
  }
  return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Cross-site request refused." } }, { status: 403 });
}

export function jsonError(err: unknown, status = 400) {
  const error = toActionError(err);
  const code = error.code === "not_found" ? 404 : error.code === "internal" ? 500 : status;
  return NextResponse.json({ ok: false, error }, { status: code });
}
