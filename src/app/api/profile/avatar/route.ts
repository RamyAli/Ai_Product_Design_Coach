import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { AppError } from "@/server/errors";
import { assertSameOrigin, jsonError } from "@/server/http";
import { avatarUploadPath, removeAvatarUpload, saveAvatarUpload } from "@/server/services/profile";
import { getSettings } from "@/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves the uploaded profile photo. The URL carries a version so a new upload is fetched fresh. */
export async function GET() {
  const { avatarUpload } = await getSettings();
  if (!avatarUpload) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(avatarUploadPath(avatarUpload));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(data.length),
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}

/** Multipart upload of a new profile photo. */
export async function POST(req: Request) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) throw new AppError("validation", "No file was received.");
    const settings = await saveAvatarUpload(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, data: { avatar: settings.avatar, avatarUpload: settings.avatarUpload } });
  } catch (err) {
    return jsonError(err, 422);
  }
}

export async function DELETE(req: Request) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  try {
    const settings = await removeAvatarUpload();
    return NextResponse.json({ ok: true, data: { avatar: settings.avatar, avatarUpload: settings.avatarUpload } });
  } catch (err) {
    return jsonError(err);
  }
}
