import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { db, parseJson } from "@/server/db";
import { assetAbsolutePath, ingestFile, processAsset, type PdfAssetMeta } from "@/server/ingestion/pipeline";
import { buildEvidence } from "@/server/services/evaluation";
import { createProject } from "@/server/services/projects";
import { ensureDraft, saveDraft } from "@/server/services/submissions";
import { clearAllData, createBackup, readBackupFile, restoreBackup, exportProjectData } from "@/server/services/backup";
import { loadSampleProjects, removeSampleProjects } from "@/server/services/sample";
import { updateSettings } from "@/server/settings";
import { buildMockBrief } from "@/server/ai/mock/generate";
import { GeneratorInputSchema } from "@/domain/brief";
import { corruptPdf, makePdf, makePng } from "../fixtures/files";

async function draftForNewProject() {
  const brief = buildMockBrief(GeneratorInputSchema.parse({ mode: "random", language: "en" }), null);
  const project = await createProject({ brief: { ...brief, workflow: [] }, status: "active", generationSource: "mock" });
  const stage = await db.stage.findFirstOrThrow({ where: { projectId: project.id, orderIndex: 1 } });
  return { project, draft: await ensureDraft(stage.id) };
}

const visionCaps = { vision: true, pdf: true, structuredOutput: true, maxImageBytes: 5e6, maxPdfBytes: 3e7 };
const textOnlyCaps = { vision: false, pdf: false, structuredOutput: true, maxImageBytes: 5e6, maxPdfBytes: 3e7 };

describe("file ingestion", () => {
  it("extracts page-referenced text from a text-based PDF", async () => {
    const { draft } = await draftForNewProject();
    const pdf = makePdf([["Problem statement", "Owners cannot find permits."], ["Success metrics", "Complete applications 70%"]]);
    const asset = await ingestFile({ submissionId: draft.id, filename: "discovery.pdf", bytes: pdf });
    expect(asset.extractionStatus).toBe("ready");
    expect(asset.extractedText).toContain("[Page 1]");
    expect(asset.extractedText).toContain("Owners cannot find permits.");
    expect(asset.extractedText).toContain("[Page 2]");
    const meta = parseJson<PdfAssetMeta>(asset.extractionMetadataJson, {});
    expect(meta.pageCount).toBe(2);
    expect(meta.textLayer).toBe("full");
  });

  it("reports image-only PDFs honestly and marks them unavailable to text-only reviewers", async () => {
    const { draft } = await draftForNewProject();
    const asset = await ingestFile({ submissionId: draft.id, filename: "scan.pdf", bytes: makePdf([null]) });
    expect(asset.extractionStatus).toBe("ready");
    expect(parseJson<PdfAssetMeta>(asset.extractionMetadataJson, {}).textLayer).toBe("none");
    const evidence = await buildEvidence({ textContent: "", notes: "", assets: [asset], capabilities: textOnlyCaps });
    expect(evidence.context.manifest[0]!.available).toBe(false);
    expect(evidence.context.codeLimitations.join()).toContain("image_only_pdf_no_ocr");
    expect(evidence.context.confidenceCap).toBeLessThan(100);
    // A PDF-capable provider receives the document itself and can see its visuals.
    const withPdf = await buildEvidence({ textContent: "", notes: "", assets: [asset], capabilities: visionCaps });
    expect(withPdf.attachments[0]!.type).toBe("pdf");
    expect(withPdf.context.visualEvidenceAvailable).toBe(true);
  });

  it("records corrupted PDFs as failed with an actionable message and allows retry", async () => {
    const { draft } = await draftForNewProject();
    const asset = await ingestFile({ submissionId: draft.id, filename: "broken.pdf", bytes: corruptPdf() });
    expect(asset.extractionStatus).toBe("failed");
    expect(asset.extractionError).toMatch(/could not be read|corrupted|extracted/i);
    const retried = await processAsset(asset.id);
    expect(retried.extractionStatus).toBe("failed");
  });

  it("rejects unsupported, mismatched, empty, oversized and duplicate files", async () => {
    const { draft } = await draftForNewProject();
    await expect(ingestFile({ submissionId: draft.id, filename: "notes.txt", bytes: Buffer.from("hello") })).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(ingestFile({ submissionId: draft.id, filename: "fake.png", bytes: Buffer.from("<script>alert(1)</script>") })).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(ingestFile({ submissionId: draft.id, filename: "empty.png", bytes: Buffer.alloc(0) })).rejects.toMatchObject({ code: "empty_file" });
    const png = await makePng();
    await ingestFile({ submissionId: draft.id, filename: "a.png", bytes: png });
    await expect(ingestFile({ submissionId: draft.id, filename: "a-copy.png", bytes: png })).rejects.toMatchObject({ code: "duplicate_file" });
    await updateSettings({ maxUploadMb: 1 });
    await expect(ingestFile({ submissionId: draft.id, filename: "big.pdf", bytes: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1.5 * 1024 * 1024)]) })).rejects.toMatchObject({ code: "file_too_large" });
    await updateSettings({ maxUploadMb: 15 });
  });

  it("sends images only to vision-capable providers and records the limitation otherwise", async () => {
    const { draft } = await draftForNewProject();
    const asset = await ingestFile({ submissionId: draft.id, filename: "screen.png", bytes: await makePng() });
    const withVision = await buildEvidence({ textContent: "Text", notes: "", assets: [asset], capabilities: visionCaps });
    expect(withVision.attachments.filter((a) => a.type === "image")).toHaveLength(1);
    expect(withVision.context.visualEvidenceAvailable).toBe(true);
    const without = await buildEvidence({ textContent: "Text", notes: "", assets: [asset], capabilities: textOnlyCaps });
    expect(without.attachments).toHaveLength(0);
    expect(without.context.codeLimitations.join()).toContain("provider_has_no_vision");
  });
});

describe("backup, restore and data management", () => {
  it("round-trips all records and uploaded files through a backup", async () => {
    const { project, draft } = await draftForNewProject();
    await saveDraft(draft.id, { textContent: "Draft text that must survive a restore." });
    const asset = await ingestFile({ submissionId: draft.id, filename: "keep.png", bytes: await makePng("#00aa00") });
    const backup = await createBackup();
    expect(backup.sizeBytes).toBeGreaterThan(0);
    const exported = await exportProjectData(project.id);
    expect(exported.project.stages).toHaveLength(8);

    await clearAllData();
    expect(await db.project.count()).toBe(0);
    expect(fs.existsSync(assetAbsolutePath(asset.storagePath!))).toBe(false);

    const result = await restoreBackup(await readBackupFile(backup.filename));
    expect(result.safetyBackup).toMatch(/pre-restore/);
    expect(await db.project.count()).toBeGreaterThanOrEqual(1);
    expect((await db.submission.findUniqueOrThrow({ where: { id: draft.id } })).textContent).toContain("must survive");
    expect(fs.existsSync(assetAbsolutePath(asset.storagePath!))).toBe(true);
  });

  it("rejects archives that are not backups", async () => {
    await expect(restoreBackup(Buffer.from("not a zip"))).rejects.toMatchObject({ code: "validation" });
  });

  it("loads three labelled sample projects at different stages of progress, using only the demo reviewer", async () => {
    const [complete, halfway, fresh] = await loadSampleProjects("ar");
    for (const p of [complete!, halfway!, fresh!]) {
      expect(p.isSample).toBe(true);
      expect(p.preferredLanguage).toBe("ar");
    }
    const stagesOf = (id: string) => db.stage.findMany({ where: { projectId: id }, orderBy: { orderIndex: "asc" } });

    expect(complete!.status).toBe("completed");
    expect((await stagesOf(complete!.id)).every((s) => s.status === "completed")).toBe(true);

    const half = await stagesOf(halfway!.id);
    expect(half.slice(0, 4).every((s) => s.status === "completed")).toBe(true);
    expect(half[4]!.status).toBe("needs_revision");
    expect(half.slice(5).every((s) => s.status === "locked")).toBe(true);
    expect(halfway!.currentStageId).toBe(half[4]!.id);

    const untouched = await stagesOf(fresh!.id);
    expect(untouched[0]!.status).toBe("available");
    expect(await db.submission.count({ where: { projectId: fresh!.id } })).toBe(0);

    const reviews = await db.review.findMany({ where: { projectId: { in: [complete!.id, halfway!.id] } } });
    expect(reviews).toHaveLength(13);
    expect(reviews.every((r) => r.isMock && r.provider === "mock")).toBe(true);
    const sampleText = await db.submission.findFirstOrThrow({ where: { projectId: complete!.id } });
    expect(sampleText.textContent).toContain("محتوى تجريبي");

    expect(await removeSampleProjects()).toBe(3);
    expect(await db.project.count({ where: { isSample: true } })).toBe(0);
  });
});
