import { NextResponse } from "next/server";
import { parseJson } from "@/server/db";
import { getJob } from "@/server/jobs/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ ok: false, error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  return NextResponse.json({
    ok: true,
    data: {
      id: job.id,
      type: job.type,
      status: job.status,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      result: parseJson<unknown>(job.resultJson, null),
      provider: job.provider,
      model: job.model,
      usage: parseJson<unknown>(job.usageJson, null),
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
    },
  });
}
