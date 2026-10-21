import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads the saved case study as Markdown. */
export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const cs = await db.caseStudy.findUnique({ where: { projectId }, include: { project: { select: { title: true } } } });
  if (!cs) return new Response("Not found", { status: 404 });
  const slug = cs.project.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60) || "case-study";
  return new Response(cs.contentMarkdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(slug)}-case-study.md`,
    },
  });
}
