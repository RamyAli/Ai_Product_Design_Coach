"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BarChart3, FolderKanban, LayoutDashboard, Menu, Settings, Sparkles, X, Compass } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setLocaleAction } from "@/app/actions/settings";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Locale } from "@/domain/enums";

export interface ShellProviderInfo {
  active: "anthropic" | "mock";
  model: string;
  realProviderReady: boolean;
}

const NAV = [
  { href: "/", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/projects", key: "projects", icon: FolderKanban, exact: false, excludes: "/projects/new" },
  { href: "/projects/new", key: "generate", icon: Sparkles, exact: true },
  { href: "/progress", key: "progress", icon: BarChart3, exact: false },
  { href: "/settings", key: "settings", icon: Settings, exact: false },
] as const;

function isActive(pathname: string, item: (typeof NAV)[number]) {
  if (item.exact) return pathname === item.href;
  if ("excludes" in item && pathname.startsWith(item.excludes)) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Footer({ provider, locale }: { provider: ShellProviderInfo; locale: Locale }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, start] = useTransition();
  const switchTo = locale === "en" ? "ar" : "en";
  return (
    <div className="flex flex-col gap-3 border-t border-border p-3">
      <Link href="/settings#ai" className="rounded-md p-2 text-xs hover:bg-surface-muted">
        <span className="block text-subtle">{t("aiProvider")}</span>
        {provider.active === "mock" ? (
          <Badge variant="warning" className="mt-1">
            {t("demoMode")}
          </Badge>
        ) : (
          <span className="ltr-isolate mt-0.5 block truncate font-medium text-foreground">{provider.model}</span>
        )}
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await setLocaleAction(switchTo);
            router.refresh();
          })
        }
        className="rounded-md border border-border px-2 py-1.5 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
        lang={switchTo}
        aria-label={t("switchLanguage")}
      >
        {switchTo === "ar" ? "العربية" : "English"}
      </button>
    </div>
  );
}

export function Sidebar({ provider, locale }: { provider: ShellProviderInfo; locale: Locale }) {
  const t = useTranslations("nav");
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-border bg-surface lg:flex" aria-label={t("primary")}>
        <Link href="/" className="flex items-center gap-2 px-4 py-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-on-primary">
            <Compass className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold leading-tight">{t("appName")}</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label={t("primary")}>
          <NavLinks />
        </nav>
        <Footer provider={provider} locale={locale} />
      </aside>
      {/* Mobile / tablet */}
      <MobileBar provider={provider} locale={locale} />
    </>
  );
}

function MobileBar({ provider, locale }: { provider: ShellProviderInfo; locale: Locale }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-on-primary">
            <Compass className="size-4" aria-hidden />
          </span>
          {t("appName")}
        </Link>
        <DialogPrimitive.Trigger className="rounded-md p-2 hover:bg-surface-muted" aria-label={t("openMenu")}>
          <Menu className="size-5" />
        </DialogPrimitive.Trigger>
      </header>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col bg-surface shadow-[var(--shadow-pop)] lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <DialogPrimitive.Title className="text-sm font-semibold">{t("appName")}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-2 hover:bg-surface-muted" aria-label={t("closeMenu")}>
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">{t("primary")}</DialogPrimitive.Description>
          <nav className="flex-1 overflow-y-auto px-2" aria-label={t("primary")}>
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
          <Footer provider={provider} locale={locale} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
