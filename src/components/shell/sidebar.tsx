"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BarChart3, ChevronsUpDown, Compass, FolderKanban, Languages, LayoutDashboard, Menu, Settings, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setLocaleAction } from "@/app/actions/settings";
import type { Locale } from "@/domain/enums";
import { cn } from "@/lib/utils";

export interface ShellProviderInfo {
  active: "anthropic" | "mock";
  model: string;
  realProviderReady: boolean;
}

export interface ShellInfo {
  provider: ShellProviderInfo;
  locale: Locale;
  displayName: string;
  activeProjects: number;
  revisionRequests: number;
}

type NavItem = { href: string; key: string; icon: typeof LayoutDashboard; exact: boolean; excludes?: string; count?: "projects" | "revisions" };

const SECTIONS: { key: string; items: NavItem[] }[] = [
  {
    key: "sectionGeneral",
    items: [
      { href: "/", key: "dashboard", icon: LayoutDashboard, exact: true, count: "revisions" },
      { href: "/projects", key: "projects", icon: FolderKanban, exact: false, excludes: "/projects/new", count: "projects" },
      { href: "/projects/new", key: "generate", icon: Sparkles, exact: true },
    ],
  },
  { key: "sectionLearning", items: [{ href: "/progress", key: "progress", icon: BarChart3, exact: false }] },
  { key: "sectionSupport", items: [{ href: "/settings", key: "settings", icon: Settings, exact: false }] },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  if (item.excludes && pathname.startsWith(item.excludes)) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Brand() {
  const t = useTranslations("nav");
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <span className="flex size-9 items-center justify-center rounded-lg bg-interactive text-on-interactive">
        <Compass className="size-5" aria-hidden />
      </span>
      <span className="text-base font-bold leading-tight">{t("appName")}</span>
    </Link>
  );
}

/** Workspace card at the top of the sidebar (like a team/plan switcher). Links to AI settings. */
function WorkspaceCard({ info }: { info: ShellInfo }) {
  const t = useTranslations("nav");
  return (
    <Link
      href="/settings#ai"
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-muted"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted">
        <FolderKanban className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{t("workspace")}</span>
        <span className="block truncate text-xs text-subtle">
          {info.provider.active === "mock" ? t("demoMode") : <span className="ltr-isolate">{info.provider.model}</span>}
          {" · "}
          {t("projectCount", { count: info.activeProjects })}
        </span>
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
    </Link>
  );
}

function NavSections({ info, onNavigate }: { info: ShellInfo; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-5">
      {SECTIONS.map((section) => (
        <div key={section.key}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{t(section.key)}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              const count = item.count === "projects" ? info.activeProjects : item.count === "revisions" ? info.revisionRequests : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-surface text-foreground shadow-[0_1px_2px_rgb(22_22_22/0.08)] ring-1 ring-border" : "text-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} aria-hidden />
                    <span className="flex-1">{t(item.key)}</span>
                    {count > 0 ? (
                      <span className="ltr-isolate rounded-md border border-border bg-surface px-1.5 text-xs font-semibold tabular-nums text-muted">{count}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** User card at the bottom of the sidebar with the language switch. */
function UserCard({ info }: { info: ShellInfo }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, start] = useTransition();
  const switchTo = info.locale === "en" ? "ar" : "en";
  const name = info.displayName || t("you");
  return (
    <div className="rounded-xl border border-border bg-surface">
      <Link href="/settings#general" className="flex items-center gap-3 rounded-t-xl p-3 hover:bg-surface-muted">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-strong text-sm font-bold text-white" aria-hidden>
          {initials(name) || "•"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" dir="auto">
            {name}
          </span>
          <span className="block truncate text-xs text-subtle">{t("localData")}</span>
        </span>
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
        className="flex w-full items-center gap-3 rounded-b-xl border-t border-border px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-60"
        aria-label={t("switchLanguage")}
      >
        <Languages className="size-[18px]" aria-hidden />
        <span lang={switchTo}>{switchTo === "ar" ? "العربية" : "English"}</span>
      </button>
    </div>
  );
}

export function Sidebar({ info }: { info: ShellInfo }) {
  const t = useTranslations("nav");
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto px-4 py-5 lg:flex" aria-label={t("primary")}>
        <Brand />
        <WorkspaceCard info={info} />
        <nav className="flex-1" aria-label={t("primary")}>
          <NavSections info={info} />
        </nav>
        <UserCard info={info} />
      </aside>
      <MobileBar info={info} />
    </>
  );
}

function MobileBar({ info }: { info: ShellInfo }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-interactive text-on-interactive">
            <Compass className="size-4" aria-hidden />
          </span>
          {t("appName")}
        </Link>
        <DialogPrimitive.Trigger className="rounded-lg p-2 hover:bg-surface-muted" aria-label={t("openMenu")}>
          <Menu className="size-5" />
        </DialogPrimitive.Trigger>
      </header>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto bg-chrome px-4 py-4 shadow-[var(--shadow-pop)] lg:hidden">
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title asChild>
              <div>
                <Brand />
              </div>
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-lg p-2 hover:bg-surface-hover" aria-label={t("closeMenu")}>
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">{t("primary")}</DialogPrimitive.Description>
          <WorkspaceCard info={info} />
          <nav className="flex-1" aria-label={t("primary")}>
            <NavSections info={info} onNavigate={() => setOpen(false)} />
          </nav>
          <UserCard info={info} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
