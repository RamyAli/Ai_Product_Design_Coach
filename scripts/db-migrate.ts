/**
 * Applies versioned Prisma migrations to the SQLite database in APP_DATA_DIR.
 * Safe to run repeatedly; never drops data.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { ensureDataDirs, getDatabaseUrl, getDataPaths } from "../src/server/config";

ensureDataDirs();
const prismaBin = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
execFileSync(prismaBin, ["migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
});
console.log(`Database ready at ${getDataPaths().database}`);
