import { execFileSync } from "node:child_process";
import path from "node:path";
import { getDatabaseUrl } from "../src/server/config";

const prismaBin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
execFileSync(prismaBin, ["studio"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: getDatabaseUrl() } });
