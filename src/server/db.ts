import { PrismaClient } from "@prisma/client";
import { ensureDataDirs, getDatabaseUrl } from "./config";

const globalForDb = globalThis as unknown as { __coachPrisma?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForDb.__coachPrisma) {
    ensureDataDirs();
    globalForDb.__coachPrisma = new PrismaClient({ datasourceUrl: getDatabaseUrl(), log: ["error"] });
  }
  return globalForDb.__coachPrisma;
}

/** Lazily-initialised client so tests and scripts can set APP_DATA_DIR before first use. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function disconnectDb(): Promise<void> {
  if (globalForDb.__coachPrisma) {
    await globalForDb.__coachPrisma.$disconnect();
    globalForDb.__coachPrisma = undefined;
  }
}

/** Parses a JSON column, returning the fallback when the stored value is empty or corrupt. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
