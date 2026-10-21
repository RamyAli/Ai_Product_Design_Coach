// Lists translation keys referenced in src/ (static keys) and dynamic template usages.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "src");
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|mts)$/.test(e.name)) files.push(p);
  }
})(root);

const keys = new Set();
const dynamic = [];
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const vars = new Map();
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g)) vars.set(m[1], m[2]);
  // translator passed as prop named t / te
  for (const [v, ns] of vars) {
    const re = new RegExp(`\\b${v}\\(\\s*(["\`])((?:[^"\`\\\\]|\\\\.)*)\\1`, "g");
    for (const m of src.matchAll(re)) {
      if (m[1] === "`" && m[2].includes("${")) dynamic.push(`${path.relative(root, f)}: ${ns}.${m[2]}`);
      else keys.add(`${ns}.${m[2]}`);
    }
  }
}
const out = { keys: [...keys].sort(), dynamic };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 2));
else console.log(JSON.stringify(out, null, 2));
