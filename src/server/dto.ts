import type { SubmissionAsset } from "@prisma/client";
import { parseJson } from "./db";
import type { AssetMeta } from "./ingestion/pipeline";

export interface AssetDto {
  id: string;
  kind: "image" | "pdf" | "figma";
  originalFilename: string;
  mimeType: string | null;
  fileSize: number | null;
  extractionStatus: string;
  extractionError: string | null;
  sourceUrl: string | null;
  hasThumbnail: boolean;
  meta: {
    width?: number;
    height?: number;
    pageCount?: number;
    textLayer?: string;
    access?: string;
    fileName?: string;
    renders?: number;
  };
  textPreview: string | null;
  createdAt: string;
}

export function toAssetDto(a: SubmissionAsset): AssetDto {
  const meta = parseJson<AssetMeta>(a.extractionMetadataJson, {});
  return {
    id: a.id,
    kind: a.kind as AssetDto["kind"],
    originalFilename: a.originalFilename,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    extractionStatus: a.extractionStatus,
    extractionError: a.extractionError,
    sourceUrl: a.sourceUrl,
    hasThumbnail: Boolean(a.thumbnailPath),
    meta: {
      width: meta.width,
      height: meta.height,
      pageCount: meta.pageCount,
      textLayer: meta.textLayer,
      access: meta.access,
      fileName: meta.fileName,
      renders: meta.renders?.length,
    },
    textPreview: a.extractedText ? a.extractedText.slice(0, 1200) : null,
    createdAt: a.createdAt.toISOString(),
  };
}
