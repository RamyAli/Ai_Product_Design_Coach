import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { SubmissionAsset } from "@prisma/client";
import { LIMITS, getDataPaths } from "../config";
import { db, parseJson } from "../db";
import { AppError, notFound } from "../errors";
import { getSecret } from "../secrets";
import { getSettings } from "../settings";
import { IngestionError } from "./errors";
import { fetchFigmaMetadata, fetchFigmaRenders, parseFigmaUrl, type FigmaAccess } from "./figma";
import { readImageMetadata, writeAnalysisCopy, writeThumbnail } from "./image";
import { extractPdf, joinPdfPages } from "./pdf";
import { ALLOWED_UPLOAD_TYPES, formatBytes, resolveStoredPath, safeJoin, sanitizeFilename, sniffMime } from "./validation";

export interface ImageAssetMeta {
  width?: number;
  height?: number;
  format?: string;
  analysisBytes?: number;
}
export interface PdfAssetMeta {
  pageCount?: number;
  textLayer?: "full" | "partial" | "none";
  textChars?: number;
  pageChars?: number[];
}
export interface FigmaAssetMeta {
  kind?: string;
  fileKey?: string;
  nodeId?: string | null;
  access?: FigmaAccess;
  fileName?: string;
  lastModified?: string;
  renders?: { path: string; name: string }[];
}
export type AssetMeta = ImageAssetMeta & PdfAssetMeta & FigmaAssetMeta;

function uploadsRoot(): string {
  return getDataPaths().uploads;
}

export function assetAbsolutePath(relative: string): string {
  return resolveStoredPath(uploadsRoot(), relative);
}

async function setStatus(id: string, data: Partial<Pick<SubmissionAsset, "extractionStatus" | "extractionError" | "extractedText" | "extractionMetadataJson" | "thumbnailPath" | "analysisPath">>) {
  return db.submissionAsset.update({ where: { id }, data });
}

async function requireDraft(submissionId: string) {
  const submission = await db.submission.findUnique({ where: { id: submissionId }, include: { assets: true } });
  if (!submission) throw notFound("Submission");
  if (submission.status !== "draft") {
    throw new AppError("forbidden_state", "Submitted versions cannot be changed. Start a new version to make changes.");
  }
  return submission;
}

/**
 * Validates, stores and processes one uploaded file for a draft submission.
 * Validation problems are rejected before anything is stored. Processing problems
 * (corrupt or unreadable content) are recorded on the asset as a failed state the user can see.
 */
export async function ingestFile(params: { submissionId: string; filename: string; bytes: Buffer }): Promise<SubmissionAsset> {
  const submission = await requireDraft(params.submissionId);
  const settings = await getSettings();
  const maxFileBytes = settings.maxUploadMb * 1024 * 1024;
  const files = submission.assets.filter((a) => a.kind !== "figma");
  const displayName = sanitizeFilename(params.filename);

  if (params.bytes.length === 0) throw new IngestionError("empty_file", `"${displayName}" is empty.`);
  if (params.bytes.length > maxFileBytes) {
    throw new IngestionError("file_too_large", `"${displayName}" is ${formatBytes(params.bytes.length)}; the limit is ${settings.maxUploadMb} MB per file.`, {
      max: settings.maxUploadMb,
    });
  }
  if (files.length >= LIMITS.maxFilesPerSubmission) {
    throw new IngestionError("too_many_files", `A submission can include up to ${LIMITS.maxFilesPerSubmission} files.`);
  }
  const total = files.reduce((s, a) => s + (a.fileSize ?? 0), 0) + params.bytes.length;
  if (total > LIMITS.maxSubmissionTotalMb * 1024 * 1024) {
    throw new IngestionError("submission_too_large", `Files in one submission can total up to ${LIMITS.maxSubmissionTotalMb} MB.`);
  }
  const mime = sniffMime(params.bytes);
  if (!mime) {
    throw new IngestionError("unsupported_type", `"${displayName}" is not a supported file. Upload PNG, JPEG, WebP or PDF files.`);
  }
  const sha256 = crypto.createHash("sha256").update(params.bytes).digest("hex");
  if (files.some((a) => a.sha256 === sha256)) {
    throw new IngestionError("duplicate_file", `"${displayName}" is already attached to this submission.`);
  }

  const { kind, ext } = ALLOWED_UPLOAD_TYPES[mime];
  const storedFilename = `${crypto.randomUUID()}.${ext}`;
  const dirSegments = [submission.projectId, submission.id];
  const relative = [...dirSegments, storedFilename].join("/");
  try {
    await fs.mkdir(safeJoin(uploadsRoot(), ...dirSegments), { recursive: true, mode: 0o700 });
    await fs.writeFile(safeJoin(uploadsRoot(), ...dirSegments, storedFilename), params.bytes, { mode: 0o600, flag: "wx" });
  } catch {
    throw new IngestionError("storage_error", "The file could not be saved. Check that the data directory is writable and has free space.");
  }

  const asset = await db.submissionAsset.create({
    data: {
      submissionId: submission.id,
      kind,
      originalFilename: displayName,
      storedFilename,
      mimeType: mime,
      fileSize: params.bytes.length,
      sha256,
      storagePath: relative,
      extractionStatus: "uploaded",
    },
  });
  return processAsset(asset.id, params.bytes);
}

/** Runs (or re-runs) validation and extraction for a stored file asset. */
export async function processAsset(assetId: string, bytes?: Buffer): Promise<SubmissionAsset> {
  const asset = await db.submissionAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound("Attachment");
  if (asset.kind === "figma") return refreshFigmaAsset(asset.id);
  if (!asset.storagePath) throw new AppError("forbidden_state", "This attachment has no stored file.");
  const abs = assetAbsolutePath(asset.storagePath);
  let buf: Buffer;
  try {
    buf = bytes ?? (await fs.readFile(abs));
  } catch {
    return setStatus(asset.id, { extractionStatus: "failed", extractionError: "The stored file is missing. Remove it and upload it again." });
  }

  await setStatus(asset.id, { extractionStatus: "validating", extractionError: null });
  try {
    if (asset.kind === "image") {
      const meta = await readImageMetadata(buf);
      await setStatus(asset.id, { extractionStatus: "extracting" });
      const base = abs.replace(/\.[a-z0-9]+$/i, "");
      const thumb = `${base}.thumb.webp`;
      const analysis = `${base}.analysis.jpg`;
      await writeThumbnail(buf, thumb);
      const analysisBytes = await writeAnalysisCopy(buf, analysis);
      const rel = (p: string) => path.relative(uploadsRoot(), p).split(path.sep).join("/");
      const metadata: ImageAssetMeta = { ...meta, analysisBytes };
      return setStatus(asset.id, {
        extractionStatus: "ready",
        thumbnailPath: rel(thumb),
        analysisPath: rel(analysis),
        extractionMetadataJson: JSON.stringify(metadata),
      });
    }
    // PDF
    await setStatus(asset.id, { extractionStatus: "extracting" });
    const result = await extractPdf(buf);
    const text = joinPdfPages(result.pages);
    const metadata: PdfAssetMeta = {
      pageCount: result.pageCount,
      textLayer: result.textLayer,
      textChars: result.pages.reduce((s, p) => s + p.length, 0),
      pageChars: result.pages.map((p) => p.length),
    };
    return setStatus(asset.id, {
      extractionStatus: "ready",
      extractedText: text,
      extractionMetadataJson: JSON.stringify(metadata),
    });
  } catch (err) {
    const message = err instanceof IngestionError ? err.message : "This file could not be processed. Try exporting it again.";
    return setStatus(asset.id, { extractionStatus: "failed", extractionError: message });
  }
}

export async function addFigmaLink(params: { submissionId: string; url: string }): Promise<SubmissionAsset> {
  const submission = await requireDraft(params.submissionId);
  const parsed = parseFigmaUrl(params.url);
  if (!parsed) {
    throw new IngestionError(
      "invalid_figma_url",
      "That does not look like a Figma file, design, prototype or board link (https://www.figma.com/…).",
    );
  }
  const links = submission.assets.filter((a) => a.kind === "figma");
  if (links.length >= LIMITS.maxFigmaLinksPerSubmission) {
    throw new IngestionError("too_many_links", `A submission can include up to ${LIMITS.maxFigmaLinksPerSubmission} Figma links.`);
  }
  if (links.some((a) => a.sourceUrl === parsed.normalizedUrl)) {
    throw new IngestionError("duplicate_file", "This Figma link is already attached.");
  }
  const asset = await db.submissionAsset.create({
    data: {
      submissionId: submission.id,
      kind: "figma",
      originalFilename: parsed.normalizedUrl.replace("https://www.figma.com/", "figma.com/").slice(0, 180),
      sourceUrl: parsed.normalizedUrl,
      extractionStatus: "validating",
      extractionMetadataJson: JSON.stringify({ kind: parsed.kind, fileKey: parsed.fileKey, nodeId: parsed.nodeId }),
    },
  });
  return refreshFigmaAsset(asset.id);
}

/** Attempts to read Figma metadata with the user's token. A link stays attached even when it cannot be opened. */
export async function refreshFigmaAsset(assetId: string): Promise<SubmissionAsset> {
  const asset = await db.submissionAsset.findUnique({ where: { id: assetId }, include: { submission: true } });
  if (!asset || !asset.sourceUrl) throw notFound("Figma link");
  const parsed = parseFigmaUrl(asset.sourceUrl);
  if (!parsed) return setStatus(asset.id, { extractionStatus: "failed", extractionError: "Invalid Figma URL." });
  await setStatus(asset.id, { extractionStatus: "extracting", extractionError: null });
  const token = getSecret("figmaAccessToken")?.value ?? null;
  const meta = await fetchFigmaMetadata(parsed, token);
  const metadata: FigmaAssetMeta = { kind: parsed.kind, fileKey: parsed.fileKey, nodeId: parsed.nodeId, access: meta.access };
  let extractedText: string | null = null;
  if (meta.access === "granted") {
    metadata.fileName = meta.fileName;
    metadata.lastModified = meta.lastModified;
    extractedText = [`Figma file: ${meta.fileName ?? "(untitled)"}`, `Last modified: ${meta.lastModified ?? "unknown"}`, "Structure (names only, not visual content):", meta.outline ?? ""].join("\n");
    // Render up to four frames (or the linked node) so vision-capable reviewers can see the design.
    try {
      const nodeIds = parsed.nodeId ? [parsed.nodeId] : (meta.frames ?? []).slice(0, 4).map((f) => f.nodeId);
      const renders = await fetchFigmaRenders(parsed.fileKey, nodeIds, token!);
      const stored: { path: string; name: string }[] = [];
      for (const r of renders) {
        const res = await fetch(r.url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (sniffMime(buf) !== "image/png" || buf.length > 20 * 1024 * 1024) continue;
        const segs = [asset.submission.projectId, asset.submission.id];
        await fs.mkdir(safeJoin(uploadsRoot(), ...segs), { recursive: true, mode: 0o700 });
        const name = `${crypto.randomUUID()}.figma.jpg`;
        await writeAnalysisCopy(buf, safeJoin(uploadsRoot(), ...segs, name));
        stored.push({ path: [...segs, name].join("/"), name: meta.frames?.find((f) => f.nodeId === r.nodeId)?.name ?? r.nodeId });
      }
      if (stored.length) metadata.renders = stored;
    } catch {
      // Renders are optional; metadata alone is still useful.
    }
  }
  return setStatus(asset.id, {
    extractionStatus: "ready",
    extractedText,
    extractionMetadataJson: JSON.stringify(metadata),
  });
}

async function deleteFileIfUnreferenced(relative: string | null, excludeAssetId: string) {
  if (!relative) return;
  const others = await db.submissionAsset.count({
    where: {
      id: { not: excludeAssetId },
      OR: [{ storagePath: relative }, { thumbnailPath: relative }, { analysisPath: relative }],
    },
  });
  if (others > 0) return;
  await fs.rm(assetAbsolutePath(relative), { force: true }).catch(() => undefined);
}

/** Removes an attachment from a draft. Files shared with earlier versions are kept. */
export async function removeAsset(assetId: string): Promise<void> {
  const asset = await db.submissionAsset.findUnique({ where: { id: assetId }, include: { submission: true } });
  if (!asset) throw notFound("Attachment");
  if (asset.submission.status !== "draft") {
    throw new AppError("forbidden_state", "Attachments on submitted versions cannot be removed.");
  }
  await db.submissionAsset.delete({ where: { id: assetId } });
  await deleteFileIfUnreferenced(asset.storagePath, assetId);
  await deleteFileIfUnreferenced(asset.thumbnailPath, assetId);
  await deleteFileIfUnreferenced(asset.analysisPath, assetId);
  const meta = parseJson<FigmaAssetMeta>(asset.extractionMetadataJson, {});
  for (const r of meta.renders ?? []) await deleteFileIfUnreferenced(r.path, assetId);
}

/** Deletes every stored file for a project (used when deleting a project). */
export async function deleteProjectFiles(projectId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]+$/.test(projectId)) return;
  await fs.rm(safeJoin(uploadsRoot(), projectId), { recursive: true, force: true }).catch(() => undefined);
}
