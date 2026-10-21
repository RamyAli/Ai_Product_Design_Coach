import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Local application data lives outside the source tree and build output so it
 * survives rebuilds and `git clean`. Override with APP_DATA_DIR.
 */
export function getDataDir(): string {
  const fromEnv = process.env.APP_DATA_DIR?.trim();
  return path.resolve(fromEnv && fromEnv.length > 0 ? fromEnv : path.join(os.homedir(), ".product-design-coach"));
}

export function getDataPaths() {
  const root = getDataDir();
  return {
    root,
    database: path.join(root, "coach.db"),
    uploads: path.join(root, "uploads"),
    backups: path.join(root, "backups"),
    tmp: path.join(root, "tmp"),
    secrets: path.join(root, "secrets.json"),
  };
}

export function getDatabaseUrl(): string {
  return `file:${getDataPaths().database}`;
}

export function ensureDataDirs(): void {
  const p = getDataPaths();
  for (const dir of [p.root, p.uploads, p.backups, p.tmp]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

/** Default limits. Upload size is user-configurable in Settings (bounded by HARD_MAX_UPLOAD_MB). */
export const LIMITS = {
  defaultMaxUploadMb: 15,
  hardMaxUploadMb: 50,
  maxSubmissionTotalMb: 80,
  maxFilesPerSubmission: 12,
  maxFigmaLinksPerSubmission: 5,
  maxPdfPages: 60,
  maxTextChars: 60_000,
  maxNotesChars: 8_000,
  /** Characters of extracted file text sent to the reviewer per asset */
  maxExtractedCharsPerAsset: 30_000,
  /** Total characters of submission evidence sent to the reviewer */
  maxReviewContextChars: 120_000,
  maxImagesPerReview: 8,
  /** Long edge in pixels for images sent to vision models */
  analysisImageMaxEdge: 1568,
  thumbnailMaxEdge: 480,
  maxConcurrentAiJobs: 2,
  aiRequestTimeoutMs: 6 * 60_000,
  /** A running job older than this with no live worker is considered interrupted */
  staleJobMs: 15 * 60_000,
} as const;
