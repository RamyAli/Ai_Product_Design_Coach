"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", path: "" },
  { key: "brief", path: "/brief" },
  { key: "workflow", path: "/workflow", also: "/stages" },
  { key: "deliverables", path: "/deliverables" },
  { key: "reviews", path: "/reviews" },
  { key: "caseStudy", path: "/case-study" },
] as const;

export function ProjectNav({ projectId }: { projectId: string }) {
  const t = useTranslations("projectNav");
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav aria-label={t("label")} className="-mb-px overflow-x-auto">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const href = `${base}${tab.path}`;
          const active = tab.path === "" ? pathname === base : pathname.startsWith(href) || ("also" in tab && pathname.startsWith(`${base}${tab.also}`));
          return (
            <li key={tab.key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-block border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "border-interactive font-semibold text-foreground" : "border-transparent text-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
