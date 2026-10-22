import sharp from "sharp";

export async function makePng(color = "#3366ff", width = 64, height = 48): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Builds a minimal valid PDF. Each page shows the given lines of text (or a drawn rectangle when null). */
export function makePdf(pages: (string[] | null)[]): Buffer {
  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1: catalog, 2: pages, 3: font, then per page: page + content
  let next = 4;
  const pageObjs: { id: number; contentId: number; content: string }[] = [];
  for (const lines of pages) {
    const id = next++;
    const contentId = next++;
    const content = lines
      ? `BT /F1 12 Tf 50 750 Td 14 TL ${lines.map((l) => `(${escapePdfText(l)}) Tj T*`).join(" ")} ET`
      : "0.2 0.4 0.8 rg 50 400 300 200 re f";
    pageObjs.push({ id, contentId, content });
    pageIds.push(id);
  }
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (const p of pageObjs) {
    objects[p.id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${p.contentId} 0 R >>`;
    objects[p.contentId] = `<< /Length ${Buffer.byteLength(p.content, "latin1")} >>\nstream\n${p.content}\nendstream`;
  }
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(out, "latin1");
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export const corruptPdf = (): Buffer => Buffer.from("%PDF-1.7\nthis is not really a pdf\n%%EOF", "latin1");

/** A Stage 1 submission that covers every mandatory deliverable with enough detail. */
export const STRONG_DISCOVERY_SUBMISSION = `# Problem statement
Permit applicants who are opening their first small business struggle to understand which municipal permits apply to them, in which order, and which documents are needed. Today they call several agencies, receive conflicting answers and submit incomplete applications, which delays opening by weeks and costs permit officers time on rework.

# Target audience and user needs
Primary users are first-time business owners opening cafés, salons or small shops. They need a plain-language list of the permits that apply to them, the order to apply in, and confidence that their documents are complete. Secondary users are permit officers who need complete applications and fewer repeated phone questions.

# Success metrics
Business goals are to reduce incomplete applications and to shorten time to opening. Metrics: share of applications submitted complete on first try (target 70 percent, baseline to be measured), checklist completion rate among starters, and median days from first visit to submitted application. Each metric maps to one objective.

# Assumptions and hypotheses
Assumption: owners abandon because of unclear requirements rather than fees. Hypothesis: a guided questionnaire will raise complete first submissions. Assumption: officers will accept validated uploads. These are not yet validated and will be tested in research with interviews of recent applicants.

# Scope and constraints
In scope: eligibility questionnaire, personalised checklist, document upload and application tracker for the web. Out of scope: payment of fees and agency back-office tools. Constraints: legal content is owned by agencies, the service must meet WCAG 2.2 AA, and it must support Arabic and English.
`;

export const WEAK_DISCOVERY_SUBMISSION = `# Problem
People find permits confusing.
`;
