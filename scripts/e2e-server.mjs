// Starts a production server with an isolated, empty data directory and the offline mock provider.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = process.argv[2] ?? "3200";
const dataDir = path.resolve(".e2e-data");
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
const env = { ...process.env, APP_DATA_DIR: dataDir, AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "", FIGMA_ACCESS_TOKEN: "" };
const bin = (name) => path.resolve("node_modules/.bin", name);

if (process.env.E2E_SKIP_BUILD !== "1" || !fs.existsSync(".next/BUILD_ID")) {
  execFileSync(bin("next"), ["build"], { stdio: "inherit", env });
}
execFileSync(bin("prisma"), ["migrate", "deploy"], { stdio: "inherit", env: { ...env, DATABASE_URL: `file:${path.join(dataDir, "coach.db")}` } });
const server = spawn(bin("next"), ["start", "-H", "127.0.0.1", "-p", port], { stdio: "inherit", env });
const stop = () => server.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
server.on("exit", (code) => process.exit(code ?? 0));
