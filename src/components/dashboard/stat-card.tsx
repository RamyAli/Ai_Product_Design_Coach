import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** KPI card: label, large value, and a small tagged context line. All values come from saved data. */
export function StatCard({
  label,
  hint,
  value,
  tag,
  tagTone = "neutral",
  context,
}: {
  label: string;
  hint: string;
  value: React.ReactNode;
  tag?: React.ReactNode;
  tagTone?: "success" | "danger" | "neutral" | "info";
  context?: React.ReactNode;
}) {
  const tone = {
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    neutral: "bg-surface-muted text-muted",
    info: "bg-info-soft text-info",
  }[tagTone];
  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
        {label}
        <span title={hint} className="text-subtle">
          <Info className="size-3.5" aria-hidden />
          <span className="sr-only">{hint}</span>
        </span>
      </p>
      <p className="ltr-isolate text-[28px] font-bold leading-none tracking-tight tabular-nums">{value}</p>
      {tag || context ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-subtle">
          {tag ? <span className={cn("rounded-md px-1.5 py-0.5 font-semibold", tone)}>{tag}</span> : null}
          {context}
        </p>
      ) : null}
    </Card>
  );
}
