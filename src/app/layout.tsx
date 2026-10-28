import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { dirFor } from "@/domain/localized";
import { getAppLocale } from "@/i18n/request";
import { INTL_LOCALE, THEME_COOKIE } from "@/lib/locale";
import type { ThemePreference } from "@/domain/enums";
import { getProviderStatus } from "@/server/ai";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

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
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: ThemePreference = themeCookie === "dark" || themeCookie === "light" ? themeCookie : "system";
  const [status, settings, projects, revisionRequests] = await Promise.all([
    getProviderStatus(),
    getSettings(),
    db.project.findMany({ select: { id: true, title: true, status: true, stages: { select: { id: true, stageKey: true } } } }),
    db.stage.count({ where: { status: { in: ["needs_revision", "needs_revalidation"] }, project: { status: { not: "archived" } } } }),
  ]);
  const lookup = {
    projects: Object.fromEntries(projects.map((p) => [p.id, p.title])),
    stages: Object.fromEntries(projects.flatMap((p) => p.stages.map((s) => [s.id, s.stageKey]))),
  };
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
              <Sidebar
                info={{
                  provider: { active: status.active, model: status.model, realProviderReady: status.realProviderReady },
                  locale,
                  displayName: settings.displayName,
                  role: settings.profileRole,
                  avatar: { avatar: settings.avatar, uploadKey: settings.avatarUpload },
                  activeProjects: projects.filter((p) => p.status === "active" || p.status === "draft").length,
                  revisionRequests,
                }}
              />
              {/* Content sits on a white panel framed by the gray app chrome */}
              <div className="flex min-w-0 flex-1 flex-col bg-background lg:my-3 lg:me-3 lg:rounded-2xl lg:border lg:border-border">
                <Topbar lookup={lookup} locale={locale} theme={theme} />
                <main id="main" className="min-w-0 flex-1">
                  {children}
                </main>
              </div>
            </div>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
