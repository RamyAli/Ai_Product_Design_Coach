import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Sidebar } from "@/components/shell/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { dirFor } from "@/domain/localized";
import { getAppLocale } from "@/i18n/request";
import { INTL_LOCALE, THEME_COOKIE } from "@/lib/locale";
import { getProviderStatus } from "@/server/ai";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: { default: t("appName"), template: `%s · ${t("appName")}` }, description: t("tagline") };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Applies the saved theme before paint to avoid a flash; "system" follows the OS setting. */
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(\\w+)/);var t=m?m[1]:"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getAppLocale();
  const messages = await getMessages();
  const t = await getTranslations("common");
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const status = await getProviderStatus();
  return (
    <html lang={locale} dir={dirFor(locale)} className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider locale={INTL_LOCALE[locale]} messages={messages}>
          <ToastProvider dismissLabel={t("dismiss")}>
            <div className="flex min-h-screen flex-col lg:flex-row">
              <Sidebar provider={{ active: status.active, model: status.model, realProviderReady: status.realProviderReady }} locale={locale} />
              <main id="main" className="min-w-0 flex-1">
                {children}
              </main>
            </div>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
