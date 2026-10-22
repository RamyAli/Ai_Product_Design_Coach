"use client";

import { ChevronRight, Monitor, Moon, Plus, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setThemeAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import type { Locale, ThemePreference } from "@/domain/enums";
import { stageTitle } from "@/domain/stages/definitions";

export interface BreadcrumbLookup {
  projects: Record<string, string>;
  stages: Record<string, string>;
}

interface Crumb {
  label: string;
  href?: string;
  dir?: "auto";
}

const PROJECT_TABS = ["brief", "workflow", "deliverables", "reviews", "case-study"] as const;
const TAB_KEYS: Record<(typeof PROJECT_TABS)[number], string> = {
  brief: "brief",
  workflow: "workflow",
  deliverables: "deliverables",
  reviews: "reviews",
  "case-study": "caseStudy",
};

function useCrumbs(lookup: BreadcrumbLookup, locale: Locale): Crumb[] {
  const pathname = usePathname();
  const tn = useTranslations("nav");
  const tp = useTranslations("projectNav");
  const tb = useTranslations("breadcrumb");
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: tn("dashboard") }];
  if (parts[0] === "progress") return [{ label: tn("progress") }];
  if (parts[0] === "settings") return [{ label: tn("settings") }];
  if (parts[0] !== "projects") return [];
  const crumbs: Crumb[] = [{ label: tn("projects"), href: "/projects" }];
  if (parts[1] === "new") return [...crumbs, { label: tn("generate") }];
  const projectId = parts[1];
  if (!projectId) return [{ label: tn("projects") }];
  const base = `/projects/${projectId}`;
  crumbs.push({ label: lookup.projects[projectId] ?? tb("project"), href: base, dir: "auto" });
  const section = parts[2];
  if (!section) return crumbs.map((c, i) => (i === crumbs.length - 1 ? { ...c, href: undefined } : c));
  if ((PROJECT_TABS as readonly string[]).includes(section)) {
    const tab = section as (typeof PROJECT_TABS)[number];
    crumbs.push({ label: tp(TAB_KEYS[tab]), href: parts[3] ? `${base}/${section}` : undefined });
    if (section === "reviews" && parts[3]) crumbs.push({ label: tb("review") });
    return crumbs;
  }
  if (section === "stages" && parts[3]) {
    const key = lookup.stages[parts[3]];
    crumbs.push({ label: tp("workflow"), href: `${base}/workflow` });
    crumbs.push({ label: key ? stageTitle(key, locale) : tb("stage"), href: parts[4] ? `${base}/stages/${parts[3]}` : undefined });
    if (parts[4] === "submit") crumbs.push({ label: tb("submission") });
  }
  return crumbs;
}

export function Topbar({ lookup, locale, theme }: { lookup: BreadcrumbLookup; locale: Locale; theme: ThemePreference }) {
  const t = useTranslations("breadcrumb");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [pending, start] = useTransition();
  const crumbs = useCrumbs(lookup, locale);
  const next: ThemePreference = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <div className="hidden items-center justify-between gap-4 border-b border-border px-6 py-3 lg:flex">
      <nav aria-label={t("label")} className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          <li className="text-subtle">{t("workspace")}</li>
          {crumbs.map((c, i) => (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="size-3.5 shrink-0 text-subtle rtl:rotate-180" aria-hidden />
              {c.href ? (
                <Link href={c.href} className="truncate text-subtle hover:text-foreground hover:underline" dir={c.dir}>
                  {c.label}
                </Link>
              ) : (
                <span className="truncate font-semibold text-foreground" aria-current="page" dir={c.dir}>
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={t("theme", { current: t(`theme_${theme}`), next: t(`theme_${next}`) })}
          title={t("theme", { current: t(`theme_${theme}`), next: t(`theme_${next}`) })}
          onClick={() =>
            start(async () => {
              await setThemeAction(next);
              const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
              document.documentElement.classList.toggle("dark", dark);
              router.refresh();
            })
          }
        >
          <ThemeIcon aria-hidden />
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/projects/new">
            <Plus aria-hidden />
            {tn("newProject")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
