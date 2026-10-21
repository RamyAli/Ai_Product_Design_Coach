import fs from "node:fs/promises";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { z } from "zod";
import { getDataPaths } from "../config";
import { db } from "../db";
import { AppError } from "../errors";
import { safeJoin } from "../ingestion/validation";

export const BACKUP_FORMAT_VERSION = 1;
const APP_ID = "product-design-coach";

/** Tables in foreign-key order. Secrets are never included. */
const TABLES = [
  "project",
  "projectBriefVersion",
  "stage",
  "task",
  "submission",
  "submissionAsset",
  "review",
  "revisionTask",
  "coachMessage",
  "caseStudy",
  "aiJob",
  "appSettings",
] as const;
type Table = (typeof TABLES)[number];
type Rows = Record<Table, Record<string, unknown>[]>;

const ManifestSchema = z.object({
  app: z.literal(APP_ID),
  formatVersion: z.number().int(),
  createdAt: z.string(),
  counts: z.record(z.string(), z.number()),
});

async function dumpTables(): Promise<Rows> {
  const delegates = db as unknown as Record<Table, { findMany: () => Promise<Record<string, unknown>[]> }>;
  const rows = {} as Rows;
  for (const t of TABLES) rows[t] = await delegates[t].findMany();
  // Running/queued jobs cannot be resumed after a restore.
  rows.aiJob = rows.aiJob.filter((j) => j.status !== "queued" && j.status !== "running");
  return rows;
}

async function listFiles(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(path.join(dir, e.name), rel)));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

export async function exportProjectData(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      briefVersions: true,
      stages: { include: { tasks: true } },
      submissions: { include: { assets: { omit: { storagePath: true, thumbnailPath: true, analysisPath: true } } } },
      reviews: { include: { revisionTasks: true } },
      coachMessages: true,
      caseStudy: true,
    },
  });
  if (!project) throw new AppError("not_found", "Project not found.");
  return { app: APP_ID, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), note: "Uploaded files are not included in this export. Use a full backup to include them.", project };
}

/** Creates a zip containing all records and uploaded files, saved under APP_DATA_DIR/backups. */
export async function createBackup(kind: "manual" | "pre_restore" = "manual") {
  const rows = await dumpTables();
  const paths = getDataPaths();
  const files = await listFiles(paths.uploads);
  const zip: Zippable = {};
  const counts = Object.fromEntries(TABLES.map((t) => [t, rows[t].length]));
  zip["manifest.json"] = strToU8(JSON.stringify({ app: APP_ID, formatVersion: BACKUP_FORMAT_VERSION, createdAt: new Date().toISOString(), counts }, null, 2));
  zip["data.json"] = strToU8(JSON.stringify(rows));
  for (const rel of files) {
    const data = await fs.readFile(safeJoin(paths.uploads, ...rel.split("/")));
    zip[`uploads/${rel}`] = [new Uint8Array(data), { level: 0 }];
  }
  const out = zipSync(zip, { level: 6 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `coach-backup-${kind === "pre_restore" ? "pre-restore-" : ""}${stamp}.zip`;
  await fs.mkdir(paths.backups, { recursive: true });
  await fs.writeFile(path.join(paths.backups, filename), out, { mode: 0o600 });
  await db.backupRecord.create({ data: { filename, sizeBytes: out.length, kind } });
  return { filename, sizeBytes: out.length };
}

export async function listBackups() {
  return db.backupRecord.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
}

export async function readBackupFile(filename: string): Promise<Buffer> {
  if (!/^coach-backup-[A-Za-z0-9-]+\.zip$/.test(filename)) throw new AppError("validation", "Invalid backup name.");
  try {
    return await fs.readFile(safeJoin(getDataPaths().backups, filename));
  } catch {
    throw new AppError("not_found", "Backup file not found.");
  }
}

function reviveDates(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" && /At$/.test(k) && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v;
  }
  return out;
}

async function wipeTables(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  const delegates = tx as unknown as Record<Table, { deleteMany: () => Promise<unknown> }>;
  for (const t of [...TABLES].reverse()) await delegates[t].deleteMany();
}

/**
 * Restores a backup zip, replacing all current data. A safety backup of the current state is
 * created first. Validation happens before anything is changed.
 */
export async function restoreBackup(buffer: Buffer) {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new AppError("validation", "This file is not a valid backup archive.");
  }
  const manifestRaw = entries["manifest.json"];
  const dataRaw = entries["data.json"];
  if (!manifestRaw || !dataRaw) throw new AppError("validation", "The backup is missing its manifest or data.");
  const manifest = ManifestSchema.safeParse(JSON.parse(strFromU8(manifestRaw)));
  if (!manifest.success) throw new AppError("validation", "This archive was not created by Product Design Coach.");
  if (manifest.data.formatVersion > BACKUP_FORMAT_VERSION) throw new AppError("validation", "This backup was created by a newer version of the app.");
  let rows: Rows;
  try {
    rows = JSON.parse(strFromU8(dataRaw)) as Rows;
  } catch {
    throw new AppError("validation", "The backup data is corrupted.");
  }
  for (const t of TABLES) if (!Array.isArray(rows[t])) throw new AppError("validation", `The backup is missing table ${t}.`);

  const uploadEntries = Object.entries(entries).filter(([name]) => name.startsWith("uploads/") && !name.endsWith("/"));
  for (const [name] of uploadEntries) {
    const segs = name.slice("uploads/".length).split("/");
    if (segs.some((s) => !/^[A-Za-z0-9._-]+$/.test(s) || s === "..")) throw new AppError("validation", "The backup contains an unsafe file path.");
  }

  const safety = await createBackup("pre_restore");
  const paths = getDataPaths();
  const staging = path.join(paths.root, `uploads.restore-${Date.now()}`);
  await fs.mkdir(staging, { recursive: true, mode: 0o700 });
  try {
    for (const [name, data] of uploadEntries) {
      const segs = name.slice("uploads/".length).split("/");
      const target = safeJoin(staging, ...segs);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, data, { mode: 0o600 });
    }
    await db.$transaction(
      async (tx) => {
        await wipeTables(tx);
        const delegates = tx as unknown as Record<Table, { createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown> }>;
        for (const t of TABLES) {
          const data = rows[t].map(reviveDates);
          for (let i = 0; i < data.length; i += 200) await delegates[t].createMany({ data: data.slice(i, i + 200) });
        }
      },
      { timeout: 120_000 },
    );
  } catch (err) {
    await fs.rm(staging, { recursive: true, force: true });
    if (err instanceof AppError) throw err;
    throw new AppError("validation", `Restore failed and no data was changed. A safety backup is at ${safety.filename}.`);
  }
  const old = path.join(paths.root, `uploads.old-${Date.now()}`);
  await fs.rename(paths.uploads, old).catch(() => undefined);
  await fs.rename(staging, paths.uploads);
  await fs.rm(old, { recursive: true, force: true });
  return { safetyBackup: safety.filename, counts: manifest.data.counts };
}

/** Deletes all projects, reviews, settings and uploaded files. Backups are kept. */
export async function clearAllData() {
  await db.$transaction(async (tx) => wipeTables(tx));
  const paths = getDataPaths();
  await fs.rm(paths.uploads, { recursive: true, force: true });
  await fs.mkdir(paths.uploads, { recursive: true, mode: 0o700 });
}
