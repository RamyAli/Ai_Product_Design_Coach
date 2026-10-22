import type { Locale } from "./enums";

/** Canonical content ships in both languages; AI or user content is a plain string in its original language. */
export type LocalizedText = string | { en: string; ar: string };

export function lt(text: LocalizedText | undefined | null, locale: Locale): string {
  if (text == null) return "";
  if (typeof text === "string") return text;
  return text[locale] || text.en;
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Detects whether user-created text is predominantly Arabic so it can be rendered with the right direction. */
export function detectTextDirection(text: string): "ltr" | "rtl" | "auto" {
  const sample = text.slice(0, 600);
  const arabic = (sample.match(/[؀-ۿݐ-ݿ]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  if (arabic === 0 && latin === 0) return "auto";
  return arabic > latin ? "rtl" : "ltr";
}
