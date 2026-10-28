"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LocaleSchema, THEMES } from "@/domain/enums";
import { getProvider, getProviderStatus } from "@/server/ai";
import { runAction } from "@/server/action";
import { AppError } from "@/server/errors";
import { describeSecret, setSecret } from "@/server/secrets";
import { saveProfile } from "@/server/services/profile";
import { parseSettingsPatch, updateSettings } from "@/server/settings";
import { LOCALE_COOKIE, THEME_COOKIE } from "@/lib/locale";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(locale: string) {
  return runAction(async () => {
    const value = LocaleSchema.parse(locale);
    (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
    await updateSettings({ locale: value });
    return null;
  });
}

export async function setThemeAction(theme: string) {
  return runAction(async () => {
    const value = z.enum(THEMES).parse(theme);
    (await cookies()).set(THEME_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
    await updateSettings({ theme: value });
    return null;
  });
}

export async function updateSettingsAction(patch: unknown) {
  return runAction(async () => {
    await updateSettings(parseSettingsPatch(patch, ["locale", "theme", "avatar", "avatarUpload"]));
    return null;
  });
}

export async function updateProfileAction(profile: unknown) {
  return runAction(async () => {
    await saveProfile(profile);
    return null;
  });
}

const KeySchema = z.string().trim().min(20).max(300).regex(/^[\x21-\x7e]+$/, "Keys contain only printable characters without spaces.");

export async function saveApiKeyAction(name: "anthropicApiKey" | "figmaAccessToken", value: string | null) {
  return runAction(async () => {
    const secretName = z.enum(["anthropicApiKey", "figmaAccessToken"]).parse(name);
    if (value === null) {
      setSecret(secretName, null);
    } else {
      if (describeSecret(secretName).source === "env") throw new AppError("conflict", "This key is set by an environment variable and cannot be changed here.");
      setSecret(secretName, KeySchema.parse(value));
    }
    return describeSecret(secretName);
  });
}

export async function testProviderAction() {
  return runAction(async () => {
    const status = await getProviderStatus();
    const provider = await getProvider();
    const result = await provider.testConnection();
    return { provider: status.active, model: provider.model, detail: result.detail };
  });
}
