import { NextResponse } from "next/server";
import { z } from "zod";
import { toAssetDto } from "@/server/dto";
import { AppError } from "@/server/errors";
import { assertSameOrigin, jsonError } from "@/server/http";
import { ingestFile } from "@/server/ingestion/pipeline";
import { ensureDraft } from "@/server/services/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Multipart upload of one file into a stage's draft submission. */
export async function POST(req: Request) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;
  try {
    const form = await req.formData();
    const stageId = z.string().min(1).max(64).parse(form.get("stageId"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("validation", "No file was received.");
    const draft = await ensureDraft(stageId);
    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await ingestFile({ submissionId: draft.id, filename: file.name, bytes });
    return NextResponse.json({ ok: true, data: { submissionId: draft.id, asset: toAssetDto(asset) } });
  } catch (err) {
    return jsonError(err, 422);
  }
}
