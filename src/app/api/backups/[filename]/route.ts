import { jsonError } from "@/server/http";
import { readBackupFile } from "@/server/services/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await ctx.params;
    const data = await readBackupFile(filename);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": String(data.length) },
    });
  } catch (err) {
    return jsonError(err, 404);
  }
}
