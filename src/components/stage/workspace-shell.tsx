"use client";

import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const KEY = "pdc.workspace.panels";
type Pane = "stages" | "work" | "mentor";

/**
 * Desktop: three areas with collapsible side panels (remembered per browser).
 * Smaller screens: a segmented switcher shows one area at a time. Each panel renders once.
 */
export function WorkspaceShell({ left, main, right }: { left: React.ReactNode; main: React.ReactNode; right: React.ReactNode }) {
  const t = useTranslations("workspace");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [pane, setPane] = useState<Pane>("work");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { l?: boolean; r?: boolean };
      if (typeof saved.l === "boolean") setLeftOpen(saved.l);
      if (typeof saved.r === "boolean") setRightOpen(saved.r);
    } catch {
      // storage unavailable — defaults apply
    }
  }, []);
  const persist = (l: boolean, r: boolean) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ l, r }));
    } catch {
      // ignore
    }
  };

  const toggleBtn = "hidden rounded-md p-2 text-subtle hover:bg-surface-muted hover:text-foreground xl:inline-flex";
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-md bg-surface-muted p-1 xl:hidden" role="group" aria-label={t("panels")}>
        {(["stages", "work", "mentor"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pane === p}
            onClick={() => setPane(p)}
            className={cn("flex-1 rounded px-3 py-1.5 text-sm font-medium", pane === p ? "bg-surface text-foreground shadow-sm" : "text-muted")}
          >
            {t(`tab_${p}`)}
          </button>
        ))}
      </div>
      <div className="xl:flex xl:items-start xl:gap-5">
        <aside aria-label={t("stagesPanel")} className={cn("xl:sticky xl:top-4 xl:block xl:shrink-0", pane === "stages" ? "block" : "hidden", leftOpen ? "xl:w-72" : "xl:w-10")}>
          <button
            type="button"
            className={cn(toggleBtn, "mb-2")}
            aria-expanded={leftOpen}
            aria-label={leftOpen ? t("collapseLeft") : t("expandLeft")}
            onClick={() => {
              setLeftOpen(!leftOpen);
              persist(!leftOpen, rightOpen);
            }}
          >
            {leftOpen ? <PanelLeftClose className="size-4 rtl:rotate-180" /> : <PanelLeftOpen className="size-4 rtl:rotate-180" />}
          </button>
          <div className={cn(!leftOpen && "xl:hidden")}>{left}</div>
        </aside>
        <div className={cn("min-w-0 xl:block xl:flex-1", pane === "work" ? "block" : "hidden")}>{main}</div>
        <aside aria-label={t("mentorPanel")} className={cn("xl:sticky xl:top-4 xl:block xl:shrink-0", pane === "mentor" ? "block" : "hidden", rightOpen ? "xl:w-[22rem]" : "xl:w-10")}>
          <div className="flex justify-end">
            <button
              type="button"
              className={cn(toggleBtn, "mb-2")}
              aria-expanded={rightOpen}
              aria-label={rightOpen ? t("collapseRight") : t("expandRight")}
              onClick={() => {
                setRightOpen(!rightOpen);
                persist(leftOpen, !rightOpen);
              }}
            >
              {rightOpen ? <PanelRightClose className="size-4 rtl:rotate-180" /> : <PanelRightOpen className="size-4 rtl:rotate-180" />}
            </button>
          </div>
          <div className={cn("xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto", !rightOpen && "xl:hidden")}>{right}</div>
        </aside>
      </div>
    </div>
  );
}
