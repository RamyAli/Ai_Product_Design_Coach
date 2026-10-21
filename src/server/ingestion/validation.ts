import path from "node:path";

export const ALLOWED_UPLOAD_TYPES = {
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
  "application/pdf": { kind: "pdf", ext: "pdf" },
} as const;
export type AllowedMime = keyof typeof ALLOWED_UPLOAD_TYPES;

/** Determines the real file type from its leading bytes. Declared MIME types are not trusted. */
export function sniffMime(buf: Uint8Array): AllowedMime | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  // PDF header may be preceded by a few bytes of junk; the spec allows it within the first 1024 bytes.
  const head = Buffer.from(buf.subarray(0, 1024)).toString("latin1");
  if (head.includes("%PDF-")) return "application/pdf";
  return null;
}

export function mimeForExtension(filename: string): AllowedMime | null {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return null;
  }
}

/**
 * Makes a user-supplied filename safe for display and metadata: strips directories,
 * control characters and bidi overrides, collapses whitespace and bounds the length.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return "file";
  if (cleaned.length <= 180) return cleaned;
  const ext = path.extname(cleaned).slice(0, 10);
  return cleaned.slice(0, 180 - ext.length) + ext;
}

/** Joins path segments under root and refuses anything that escapes it (path traversal). */
export function safeJoin(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  for (const s of segments) {
    if (!/^[A-Za-z0-9._-]+$/.test(s) || s === "." || s === "..") throw new Error(`Unsafe path segment: ${s}`);
  }
  const full = path.resolve(resolvedRoot, ...segments);
  if (full !== resolvedRoot && !full.startsWith(resolvedRoot + path.sep)) throw new Error("Path escapes storage root");
  return full;
}

/** Resolves a stored relative path (as saved in the database) under the uploads root. */
export function resolveStoredPath(root: string, relative: string): string {
  return safeJoin(root, ...relative.split("/"));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
