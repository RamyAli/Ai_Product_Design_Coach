import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BriefCoreSchema, GeneratorInputSchema, validateBriefRules } from "@/domain/brief";
import { dirFor, detectTextDirection, lt } from "@/domain/localized";
import { mapAnthropicError } from "@/server/ai/anthropic";
import { AIError } from "@/server/ai/errors";
import { buildMockBrief } from "@/server/ai/mock/generate";
import { extractJson, runStructuredWithRecovery } from "@/server/ai/structured";
import { parseFigmaUrl } from "@/server/ingestion/figma";
import { safeJoin, sanitizeFilename, sniffMime } from "@/server/ingestion/validation";
import { appLocale, INTL_LOCALE } from "@/lib/locale";
import { estimateCostUsd } from "@/server/ai/pricing";

describe("project generation schema", () => {
  it("accepts generator input with partial information and rejects a single feature in random mode", () => {
    expect(GeneratorInputSchema.parse({ mode: "custom" })).toMatchObject({ difficulty: "medium", focusFeatures: [] });
    expect(GeneratorInputSchema.safeParse({ mode: "random", focusFeatures: ["a"] }).success).toBe(false);
    expect(GeneratorInputSchema.safeParse({ mode: "custom", focusFeatures: ["a", "b", "c", "d", "e"] }).success).toBe(false);
  });
  it("validates brief rules beyond the schema", () => {
    const brief = buildMockBrief(GeneratorInputSchema.parse({ mode: "random" }), null);
    expect(BriefCoreSchema.parse(brief)).toBeTruthy();
    expect(validateBriefRules(brief)).toEqual([]);
    expect(validateBriefRules({ ...brief, focusFeatures: brief.focusFeatures.slice(0, 1) })[0]).toMatch(/2–4/);
    expect(validateBriefRules({ ...brief, focusFeatures: [brief.focusFeatures[0]!, brief.focusFeatures[0]!] })).toContain("focusFeatures must be distinct");
  });
});

describe("AI response parsing and recovery", () => {
  it("extracts JSON from fenced or prefixed text", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Sure! {"a":3} done')).toEqual({ a: 3 });
    expect(() => extractJson("no json")).toThrow();
  });

  it("retries with corrective feedback after malformed output, then succeeds", async () => {
    const replies = ["not json", '{"n":"x"}', '{"n":5}'];
    const corrections: (string | null)[] = [];
    const result = await runStructuredWithRecovery({
      provider: "anthropic",
      model: "m",
      schema: z.object({ n: z.number() }),
      call: async (correction) => {
        corrections.push(correction);
        return { text: replies.shift()!, usage: { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001 }, model: "m" };
      },
    });
    expect(result.data).toEqual({ n: 5 });
    expect(result.attempts).toBe(3);
    expect(result.usage?.inputTokens).toBe(30);
    expect(corrections[0]).toBeNull();
    expect(corrections[1]).toMatch(/not valid JSON/);
    expect(corrections[2]).toMatch(/did not match the required schema/);
  });

  it("fails with a controlled error when output never validates", async () => {
    await expect(
      runStructuredWithRecovery({ provider: "anthropic", model: "m", schema: z.object({ n: z.number() }), maxAttempts: 2, call: async () => ({ text: "{}", usage: null, model: "m" }) }),
    ).rejects.toMatchObject({ code: "malformed_output" });
  });

  it("applies domain validation as part of recovery", async () => {
    const replies = ['{"n":1}', '{"n":2}'];
    const r = await runStructuredWithRecovery({ provider: "mock", model: "m", schema: z.object({ n: z.number() }), validate: (d) => (d.n < 2 ? ["n must be >= 2"] : []), call: async () => ({ text: replies.shift()!, usage: null, model: "m" }) });
    expect(r.data.n).toBe(2);
  });

  it("retries a transient provider error once, then surfaces it", async () => {
    let calls = 0;
    await expect(
      runStructuredWithRecovery({
        provider: "anthropic",
        model: "m",
        schema: z.object({}),
        call: async () => {
          calls++;
          throw new AIError("overloaded", "busy");
        },
      }),
    ).rejects.toMatchObject({ code: "overloaded" });
    expect(calls).toBe(2);
  });
});

describe("provider error handling", () => {
  const headers = new Headers();
  it("maps SDK errors to safe, typed errors", () => {
    expect(mapAnthropicError(new Anthropic.AuthenticationError(401, { message: "bad key sk-ant-secret" }, "bad key", headers)).code).toBe("authentication");
    expect(mapAnthropicError(new Anthropic.RateLimitError(429, {}, "slow down", headers)).code).toBe("rate_limited");
    expect(mapAnthropicError(new Anthropic.NotFoundError(404, {}, "model", headers)).code).toBe("invalid_request");
    expect(mapAnthropicError(new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "prompt is too long: 1200000 tokens" } }, undefined, headers)).code).toBe("context_too_large");
    expect(mapAnthropicError(new Anthropic.InternalServerError(500, {}, "boom", headers)).code).toBe("overloaded");
    expect(mapAnthropicError(new Anthropic.APIConnectionError({ message: "down" })).code).toBe("network");
    const e = mapAnthropicError(new Anthropic.AuthenticationError(401, {}, "contains sk-ant-api03-xyz", headers));
    expect(e.message).not.toMatch(/sk-ant/);
    expect(e.retryable).toBe(false);
    expect(mapAnthropicError(new Anthropic.RateLimitError(429, {}, "x", headers)).retryable).toBe(true);
  });
  it("estimates cost only for known models", () => {
    expect(estimateCostUsd("claude-opus-5-5", 1_000_000, 0)).toBe(4);
    expect(estimateCostUsd("unknown-model", 1000, 1000)).toBeNull();
  });
});

describe("file validation", () => {
  it("detects real file types from magic bytes", () => {
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(Buffer.from("RIFF0000WEBPVP8 ", "latin1"))).toBe("image/webp");
    expect(sniffMime(Buffer.from("%PDF-1.7\n", "latin1"))).toBe("application/pdf");
    expect(sniffMime(Buffer.from("GIF89a"))).toBeNull();
    expect(sniffMime(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
  it("sanitizes filenames and blocks path traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\x\\evil.png")).toBe("evil.png");
    expect(sanitizeFilename("a\u202Egnp.exe")).toBe("agnp.exe");
    expect(sanitizeFilename("...")).toBe("file");
    expect(sanitizeFilename(`${"x".repeat(300)}.pdf`)).toHaveLength(180);
    expect(() => safeJoin("/data/uploads", "..", "secrets.json")).toThrow();
    expect(() => safeJoin("/data/uploads", "a/../../b")).toThrow();
    expect(safeJoin("/data/uploads", "p1", "s1", "f.png")).toBe("/data/uploads/p1/s1/f.png");
  });
  it("validates and normalizes Figma URLs", () => {
    expect(parseFigmaUrl("https://www.figma.com/design/AbCdEfGhIjKl/My-File?node-id=12-34&t=x")).toEqual({
      kind: "design",
      fileKey: "AbCdEfGhIjKl",
      nodeId: "12:34",
      normalizedUrl: "https://www.figma.com/design/AbCdEfGhIjKl/My-File?node-id=12-34",
    });
    expect(parseFigmaUrl("https://figma.com/proto/AbCdEfGhIjKl/x")?.kind).toBe("proto");
    expect(parseFigmaUrl("https://www.figma.com/design/AbCdEfGhIjKl/branch/ZyXwVuTsRqPo/x")?.fileKey).toBe("ZyXwVuTsRqPo");
    expect(parseFigmaUrl("http://www.figma.com/design/AbCdEfGhIjKl/x")).toBeNull();
    expect(parseFigmaUrl("https://figma.com.evil.io/design/AbCdEfGhIjKl")).toBeNull();
    expect(parseFigmaUrl("https://www.figma.com/community/file/123")).toBeNull();
    expect(parseFigmaUrl("not a url")).toBeNull();
  });
});

describe("locale and direction", () => {
  it("selects direction and Intl locale", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
    expect(INTL_LOCALE.ar).toBe("ar-u-nu-latn");
    expect(appLocale("ar-u-nu-latn")).toBe("ar");
    expect(appLocale("en")).toBe("en");
    expect(lt({ en: "Hi", ar: "مرحبا" }, "ar")).toBe("مرحبا");
    expect(lt("plain", "ar")).toBe("plain");
  });
  it("detects the direction of user content", () => {
    expect(detectTextDirection("بيان المشكلة: المستخدمون")).toBe("rtl");
    expect(detectTextDirection("Problem statement")).toBe("ltr");
    expect(detectTextDirection("12345 — 678")).toBe("auto");
  });
  it("formats Arabic numbers with Latin digits for consistency", () => {
    expect(new Intl.NumberFormat(INTL_LOCALE.ar).format(85)).toBe("85");
  });
});
