import { NextResponse } from "next/server";
import { AppError } from "@/server/errors";
import { assertSameOrigin, jsonError } from "@/server/http";
import { restoreBackup } from "@/server/services/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replaces all local data with a backup archive. Requires typing RESTORE. A safety backup is made first. */
export async function POST(req: Request) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  try {
    const form = await req.formData();
    if (form.get("confirm") !== "RESTORE") throw new AppError("validation", "Type RESTORE to confirm.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("validation", "Choose a backup file.");
    const result = await restoreBackup(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return jsonError(err, 422);
  }
}
