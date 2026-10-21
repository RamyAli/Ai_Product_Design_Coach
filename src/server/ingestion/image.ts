import sharp from "sharp";
import { LIMITS } from "../config";
import { IngestionError } from "./errors";

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

export async function readImageMetadata(buf: Buffer): Promise<ImageMetadata> {
  try {
    const meta = await sharp(buf, { failOn: "error" }).metadata();
    if (!meta.width || !meta.height || !meta.format) throw new Error("missing dimensions");
    return { width: meta.width, height: meta.height, format: meta.format };
  } catch (err) {
    throw new IngestionError("image_unreadable", "The image could not be decoded. It may be corrupted.", {
      detail: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
  }
}

export async function writeThumbnail(buf: Buffer, outPath: string): Promise<void> {
  await sharp(buf)
    .rotate()
    .resize({ width: LIMITS.thumbnailMaxEdge, height: LIMITS.thumbnailMaxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(outPath);
}

/** Downscaled JPEG used for vision requests; keeps request size and token cost bounded. */
export async function writeAnalysisCopy(buf: Buffer, outPath: string): Promise<number> {
  const info = await sharp(buf)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: LIMITS.analysisImageMaxEdge, height: LIMITS.analysisImageMaxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outPath);
  return info.size;
}
