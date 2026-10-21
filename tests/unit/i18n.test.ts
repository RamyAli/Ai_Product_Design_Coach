import { describe, expect, it } from "vitest";
import { IntlMessageFormat } from "intl-messageformat";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

type Tree = { [k: string]: string | Tree };
function flatten(t: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) {
    if (typeof v === "string") out[prefix + k] = v;
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  }
  return out;
}

describe("message catalogs", () => {
  const fe = flatten(en as Tree);
  const fa = flatten(ar as Tree);
  it("English and Arabic have exactly the same keys", () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(fe).sort());
  });
  it("every message is valid ICU and uses the same placeholders in both languages", () => {
    const args = (s: string) => new Set([...s.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]));
    for (const key of Object.keys(fe)) {
      expect(() => new IntlMessageFormat(fe[key]!, "en"), key).not.toThrow();
      expect(() => new IntlMessageFormat(fa[key]!, "ar"), key).not.toThrow();
      expect([...args(fa[key]!)].sort(), key).toEqual([...args(fe[key]!)].sort());
    }
  });
  it("Arabic plurals format for every plural category", () => {
    const msg = new IntlMessageFormat((ar as Tree & { workspace: { files: string } }).workspace.files, "ar");
    expect(msg.format({ count: 0 })).toBe("بلا ملفات");
    expect(msg.format({ count: 1 })).toBe("ملف واحد");
    expect(msg.format({ count: 2 })).toBe("ملفان");
    expect(msg.format({ count: 5 })).toContain("ملفات");
    expect(msg.format({ count: 11 })).toContain("ملفاً");
  });
});
