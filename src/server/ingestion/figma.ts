export const FIGMA_LINK_KINDS = ["file", "design", "proto", "board", "make", "slides"] as const;
export type FigmaLinkKind = (typeof FIGMA_LINK_KINDS)[number];

export interface ParsedFigmaUrl {
  kind: FigmaLinkKind;
  fileKey: string;
  nodeId: string | null;
  normalizedUrl: string;
}

/**
 * Validates and normalises a Figma URL. Only https figma.com links to files, designs,
 * prototypes, boards, Make or Slides files are accepted. Returns null when unsupported.
 */
export function parseFigmaUrl(raw: string): ParsedFigmaUrl | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "figma.com" && url.hostname !== "www.figma.com") return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const kind = segments[0] as FigmaLinkKind | undefined;
  if (!kind || !FIGMA_LINK_KINDS.includes(kind)) return null;
  let fileKey = segments[1];
  // Branch URLs: /design/:fileKey/branch/:branchKey/:name — the branch key addresses the file.
  if (segments[2] === "branch" && segments[3]) fileKey = segments[3];
  if (!fileKey || !/^[A-Za-z0-9]{10,64}$/.test(fileKey)) return null;
  const rawNode = url.searchParams.get("node-id");
  const nodeId = rawNode && /^[0-9]+[-:][0-9]+$/.test(rawNode) ? rawNode.replace("-", ":") : null;
  const name = segments[segments[2] === "branch" ? 4 : 2];
  const normalizedUrl =
    `https://www.figma.com/${kind}/${fileKey}${name ? `/${encodeURIComponent(decodeURIComponent(name))}` : ""}` +
    (nodeId ? `?node-id=${nodeId.replace(":", "-")}` : "");
  return { kind, fileKey, nodeId, normalizedUrl };
}

export type FigmaAccess = "not_configured" | "granted" | "denied" | "not_found" | "rate_limited" | "unsupported" | "error";

export interface FigmaFrameRender {
  nodeId: string;
  name: string;
  url: string;
}

export interface FigmaMetadataResult {
  access: FigmaAccess;
  fileName?: string;
  lastModified?: string;
  outline?: string;
  frames?: { nodeId: string; name: string }[];
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

const API = "https://api.figma.com/v1";

async function figmaFetch(path: string, token: string, signal?: AbortSignal): Promise<Response> {
  return fetch(`${API}${path}`, {
    headers: { "X-Figma-Token": token },
    signal: signal ?? AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

function accessFromStatus(status: number): FigmaAccess {
  if (status === 403 || status === 401) return "denied";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "error";
}

/**
 * Reads file and frame names through the Figma REST API using the user's own token.
 * Respects Figma permissions: any 4xx is reported, never worked around.
 */
export async function fetchFigmaMetadata(parsed: ParsedFigmaUrl, token: string | null): Promise<FigmaMetadataResult> {
  if (!token) return { access: "not_configured" };
  if (parsed.kind === "make" || parsed.kind === "slides") return { access: "unsupported" };
  try {
    const res = await figmaFetch(`/files/${parsed.fileKey}?depth=2`, token);
    if (!res.ok) return { access: accessFromStatus(res.status) };
    const body = (await res.json()) as { name?: string; lastModified?: string; document?: FigmaNode };
    const pages = body.document?.children ?? [];
    const frames: { nodeId: string; name: string }[] = [];
    const lines: string[] = [];
    for (const page of pages.slice(0, 20)) {
      lines.push(`Page: ${page.name}`);
      for (const child of (page.children ?? []).slice(0, 40)) {
        if (["FRAME", "COMPONENT", "COMPONENT_SET", "SECTION"].includes(child.type)) {
          lines.push(`  - ${child.type.toLowerCase()}: ${child.name}`);
          if (child.type === "FRAME") frames.push({ nodeId: child.id, name: child.name });
        }
      }
    }
    return {
      access: "granted",
      fileName: body.name,
      lastModified: body.lastModified,
      outline: lines.join("\n"),
      frames,
    };
  } catch {
    return { access: "error" };
  }
}

/** Requests PNG renders for a few frames so a vision model can see the design. */
export async function fetchFigmaRenders(fileKey: string, nodeIds: string[], token: string): Promise<{ nodeId: string; url: string }[]> {
  if (nodeIds.length === 0) return [];
  const res = await figmaFetch(`/images/${fileKey}?ids=${encodeURIComponent(nodeIds.join(","))}&format=png&scale=1`, token);
  if (!res.ok) return [];
  const body = (await res.json()) as { images?: Record<string, string | null> };
  return Object.entries(body.images ?? {})
    .filter((e): e is [string, string] => typeof e[1] === "string")
    .map(([nodeId, url]) => ({ nodeId, url }));
}
