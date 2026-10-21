import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Builds a migrated template database once; each test file copies it into its own data dir. */
export default function setup() {
  const root = path.resolve(".test-data");
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const template = path.join(root, "template.db");
  execFileSync(path.resolve("node_modules/.bin/prisma"), ["migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${template}` },
    stdio: "ignore",
  });
  return () => fs.rmSync(root, { recursive: true, force: true });
}
