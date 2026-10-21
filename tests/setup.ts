import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

const root = path.resolve(".test-data");
const dir = path.join(root, `run-${process.pid}-${Math.random().toString(36).slice(2)}`);
fs.mkdirSync(dir, { recursive: true });
const template = path.join(root, "template.db");
if (fs.existsSync(template)) fs.copyFileSync(template, path.join(dir, "coach.db"));
process.env.APP_DATA_DIR = dir;
process.env.AI_PROVIDER = "mock";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.FIGMA_ACCESS_TOKEN;

afterEach(async () => {
  const { MockProvider } = await import("@/server/ai/mock");
  MockProvider.failNext = null;
  MockProvider.rawOverride = [];
});

afterAll(async () => {
  const { disconnectDb } = await import("@/server/db");
  await disconnectDb();
  fs.rmSync(dir, { recursive: true, force: true });
});
