import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { INTL_LOCALE, LOCALE_COOKIE } from "@/lib/locale";
import type { Locale } from "@/domain/enums";

export async function getAppLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "ar" ? "ar" : "en";
}

export default getRequestConfig(async () => {
  const locale = await getAppLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return {
    locale: INTL_LOCALE[locale],
    messages,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Missing keys fall back to the key path rather than crashing the page.
    onError(error) {
      if (process.env.NODE_ENV !== "production") console.warn(`[i18n] ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
