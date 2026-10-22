import { z } from "zod";
import { LocaleSchema, STRICTNESS_LEVELS, THEMES } from "@/domain/enums";
import { LIMITS } from "./config";
import { db } from "./db";

export const PROVIDER_PREFERENCES = ["auto", "anthropic", "mock"] as const;
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh"] as const;
export const DEFAULT_MODEL = "claude-opus-5-5";

export const AppSettingsSchema = z.object({
  displayName: z.string().trim().max(60).default(""),
  locale: LocaleSchema.default("en"),
  theme: z.enum(THEMES).default("system"),
  aiProvider: z.enum(PROVIDER_PREFERENCES).default("auto"),
  aiModel: z.string().trim().min(1).max(100).default(DEFAULT_MODEL),
  aiEffort: z.enum(EFFORT_LEVELS).default("high"),
  maxUploadMb: z.number().int().min(1).max(LIMITS.hardMaxUploadMb).default(LIMITS.defaultMaxUploadMb),
  strictness: z.enum(STRICTNESS_LEVELS).default("standard"),
  defaultPracticeMode: z.boolean().default(false),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type AppSettingKey = keyof AppSettings;

export const DEFAULT_SETTINGS: AppSettings = AppSettingsSchema.parse({});

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.appSettings.findMany();
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      raw[row.key] = JSON.parse(row.valueJson);
    } catch {
      // ignore corrupt values; defaults apply
    }
  }
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(AppSettingsSchema.shape) as AppSettingKey[]) {
    if (!(key in raw)) continue;
    const parsed = AppSettingsSchema.shape[key].safeParse(raw[key]);
    if (parsed.success) merged[key] = parsed.data;
  }
  if (!raw.aiModel && process.env.AI_MODEL?.trim()) merged.aiModel = process.env.AI_MODEL.trim();
  return merged as AppSettings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const validated = AppSettingsSchema.partial().parse(patch);
  await db.$transaction(
    Object.entries(validated).map(([key, value]) =>
      db.appSettings.upsert({
        where: { key },
        create: { key, valueJson: JSON.stringify(value) },
        update: { valueJson: JSON.stringify(value) },
      }),
    ),
  );
  return getSettings();
}
