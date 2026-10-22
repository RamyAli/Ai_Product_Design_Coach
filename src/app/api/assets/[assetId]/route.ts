import fs from "node:fs/promises";
import { db } from "@/server/db";
import { assetAbsolutePath } from "@/server/ingestion/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves an uploaded file or its thumbnail. Files are never served from the public directory. */
export async function GET(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params;
  const variant = new URL(req.url).searchParams.get("variant") === "thumbnail" ? "thumbnail" : "original";
  const asset = await db.submissionAsset.findUnique({ where: { id: assetId } });
  if (!asset || asset.kind === "figma") return new Response("Not found", { status: 404 });
  const relative = variant === "thumbnail" ? asset.thumbnailPath : asset.storagePath;
  if (!relative) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(assetAbsolutePath(relative));
    const type = variant === "thumbnail" ? "image/webp" : (asset.mimeType ?? "application/octet-stream");
    const filename = encodeURIComponent(asset.originalFilename);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(data.length),
        "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        // Sandboxed so an uploaded PDF cannot run scripts in the app's origin.
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("File missing", { status: 404 });
  }
}
