import type { Locale } from "@/domain/enums";

/** next-intl locale tags. Arabic uses Latin digits so scores and numbers read consistently. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en", ar: "ar-u-nu-latn" };

export function appLocale(intlLocale: string): Locale {
  return intlLocale.startsWith("ar") ? "ar" : "en";
}

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const THEME_COOKIE = "pdc_theme";
