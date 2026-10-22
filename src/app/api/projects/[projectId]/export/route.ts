import { jsonError } from "@/server/http";
import { exportProjectData } from "@/server/services/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await ctx.params;
    const data = await exportProjectData(projectId);
    const slug = data.project.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60) || "project";
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(slug)}-export.json`,
      },
    });
  } catch (err) {
    return jsonError(err, 404);
  }
}
