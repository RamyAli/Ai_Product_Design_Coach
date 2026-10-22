import fs from "node:fs";
import { z } from "zod";
import { ensureDataDirs, getDataPaths } from "./config";

/**
 * Provider credentials are never stored in the database. They come from environment
 * variables or, when entered in Settings, from a local file readable only by the
 * current OS user (mode 0600) inside APP_DATA_DIR. Never sent to the client.
 */
const SecretsSchema = z.object({
  anthropicApiKey: z.string().optional(),
  figmaAccessToken: z.string().optional(),
});
type Secrets = z.infer<typeof SecretsSchema>;
export type SecretName = keyof Secrets;

function readFile(): Secrets {
  try {
    const raw = fs.readFileSync(getDataPaths().secrets, "utf8");
    const parsed = SecretsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function writeFile(secrets: Secrets): void {
  ensureDataDirs();
  const file = getDataPaths().secrets;
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Best effort on filesystems without POSIX permissions.
  }
}

const ENV_NAMES: Record<SecretName, string> = {
  anthropicApiKey: "ANTHROPIC_API_KEY",
  figmaAccessToken: "FIGMA_ACCESS_TOKEN",
};

export function getSecret(name: SecretName): { value: string; source: "env" | "file" } | null {
  const env = process.env[ENV_NAMES[name]]?.trim();
  if (env) return { value: env, source: "env" };
  const fromFile = readFile()[name]?.trim();
  return fromFile ? { value: fromFile, source: "file" } : null;
}

export function setSecret(name: SecretName, value: string | null): void {
  const current = readFile();
  if (value && value.trim()) current[name] = value.trim();
  else delete current[name];
  writeFile(current);
}

export function maskSecret(value: string): string {
  if (value.length <= 10) return "••••";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

export function describeSecret(name: SecretName): { configured: boolean; source: "env" | "file" | null; masked: string | null } {
  const s = getSecret(name);
  return s ? { configured: true, source: s.source, masked: maskSecret(s.value) } : { configured: false, source: null, masked: null };
}
