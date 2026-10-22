"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/domain/enums";
import { INTL_LOCALE } from "@/lib/locale";
import { cn } from "@/lib/utils";

interface Day {
  date: string;
  submissions: number;
  reviews: number;
}

const LEVEL_CLASS = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"] as const;
const level = (n: number) => (n <= 0 ? 0 : n >= 4 ? 4 : n);

/** Calendar heatmap of real activity: one column per week, one row per weekday. */
export function ActivityHeatmap({ days, locale }: { days: Day[]; locale: Locale }) {
  const t = useTranslations("dashboard");
  const [metric, setMetric] = useState<"submissions" | "reviews">("submissions");
  const fmtDay = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" });
  const fmtWeekday = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short" });
  const fmtMonth = new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short" });

  // Pad the start so each column starts on the same weekday as the first day.
  const parsed = days.map((d) => ({ ...d, at: new Date(`${d.date}T00:00:00`) }));
  const firstWeekday = parsed[0]?.at.getDay() ?? 0;
  const cells: (typeof parsed[number] | null)[] = [...Array<null>(firstWeekday).fill(null), ...parsed];
  const columns: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));
  const total = parsed.reduce((n, d) => n + d[metric], 0);
  const weekdayLabels = [1, 3, 5].map((wd) => {
    const ref = new Date(2024, 0, 7 + wd); // a known Sunday-based week
    return { row: wd, label: fmtWeekday.format(ref) };
  });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{t("activityTitle")}</CardTitle>
          <p className="mt-0.5 text-xs text-subtle">{t(metric === "submissions" ? "activityTotalSubmissions" : "activityTotalReviews", { count: total })}</p>
        </div>
        <div role="group" aria-label={t("activityMetric")} className="inline-flex rounded-lg bg-surface-muted p-1">
          {(["submissions", "reviews"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={cn("rounded-md px-3 py-1 text-xs font-semibold", metric === m ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground")}
            >
              {t(m === "submissions" ? "activitySubmissions" : "activityReviews")}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-subtle" aria-hidden>
          {[1, 2, 3, 4].map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", LEVEL_CLASS[l])} />
              <span className="ltr-isolate">{l === 4 ? "4+" : l}</span>
            </span>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="grid shrink-0 grid-rows-7 gap-1.5 pt-5 text-[11px] text-subtle" aria-hidden>
            {Array.from({ length: 7 }, (_, row) => (
              <span key={row} className="flex h-4 items-center">
                {weekdayLabels.find((w) => w.row === row)?.label ?? ""}
              </span>
            ))}
          </div>
          <div role="img" aria-label={t("activityAria", { count: total, weeks: columns.length })} className="flex min-w-[36rem] flex-1 gap-1.5">
            {columns.map((col, ci) => {
              const first = col.find(Boolean);
              const showMonth = first && (ci === 0 || first.at.getDate() <= 7);
              return (
                <div key={ci} className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="h-3.5 text-[11px] leading-none whitespace-nowrap text-subtle">{showMonth ? fmtMonth.format(first.at) : ""}</span>
                  {Array.from({ length: 7 }, (_, row) => {
                    const d = col[row];
                    if (!d) return <span key={row} className="h-4 w-full" />;
                    const n = d[metric];
                    return (
                      <span
                        key={row}
                        title={`${fmtDay.format(d.at)} · ${t(metric === "submissions" ? "activityCellSubmissions" : "activityCellReviews", { count: n })}`}
                        className={cn("h-4 w-full rounded-[3px]", LEVEL_CLASS[level(n)])}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
