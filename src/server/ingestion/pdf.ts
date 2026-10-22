import { extractText, getDocumentProxy } from "unpdf";
import { LIMITS } from "../config";
import { IngestionError } from "./errors";

export interface PdfExtraction {
  pageCount: number;
  pages: string[];
  textLayer: "full" | "partial" | "none";
}

/** Characters per page below which a page is considered image-only (likely scanned). */
const MIN_CHARS_PER_PAGE = 20;

export async function extractPdf(buf: Buffer, maxPages: number = LIMITS.maxPdfPages): Promise<PdfExtraction> {
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    doc = await getDocumentProxy(new Uint8Array(buf));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password/i.test(message) || (err as { name?: string })?.name === "PasswordException") {
      throw new IngestionError("pdf_encrypted", "This PDF is password-protected. Export an unprotected copy and upload it again.");
    }
    throw new IngestionError("pdf_unreadable", "This PDF could not be read. It may be corrupted; try exporting it again.", {
      detail: message.slice(0, 120),
    });
  }
  try {
    if (doc.numPages > maxPages) {
      throw new IngestionError("pdf_too_many_pages", `This PDF has ${doc.numPages} pages; the limit is ${maxPages}. Split it or export only the relevant pages.`, {
        pages: doc.numPages,
        max: maxPages,
      });
    }
    const { totalPages, text } = await extractText(doc, { mergePages: false });
    const pages = (Array.isArray(text) ? text : [text]).map((t) => t.replace(/[ \t]+\n/g, "\n").trim());
    const withText = pages.filter((p) => p.length >= MIN_CHARS_PER_PAGE).length;
    const textLayer = withText === 0 ? "none" : withText === pages.length ? "full" : "partial";
    return { pageCount: totalPages, pages, textLayer };
  } catch (err) {
    if (err instanceof IngestionError) throw err;
    throw new IngestionError("pdf_unreadable", "Text could not be extracted from this PDF.", {
      detail: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
  } finally {
    await doc.cleanup().catch(() => undefined);
  }
}

/** Joins pages with explicit markers so reviewers can cite page numbers. */
export function joinPdfPages(pages: string[]): string {
  return pages.map((p, i) => `[Page ${i + 1}]\n${p || "(no extractable text on this page)"}`).join("\n\n");
}
