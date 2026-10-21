import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({ value, label, className, tone = "primary" }: { value: number; label: string; className?: string; tone?: "primary" | "success" | "warning" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width]", color)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

const alertStyles = {
  info: { box: "border-info/30 bg-info-soft text-foreground", icon: Info, iconClass: "text-info" },
  success: { box: "border-success/30 bg-success-soft text-foreground", icon: CheckCircle2, iconClass: "text-success" },
  warning: { box: "border-warning/30 bg-warning-soft text-foreground", icon: AlertTriangle, iconClass: "text-warning" },
  danger: { box: "border-danger/30 bg-danger-soft text-foreground", icon: XCircle, iconClass: "text-danger" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
  role,
}: {
  tone?: keyof typeof alertStyles;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  role?: "alert" | "status";
}) {
  const s = alertStyles[tone];
  const Icon = s.icon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-lg border p-3.5 text-sm", s.box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", s.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn("text-muted", title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 rounded-full bg-primary-soft p-3 text-primary [&_svg]:size-5">{icon}</div> : null}
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} aria-hidden />;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-medium uppercase tracking-wide text-subtle">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, className, as: As = "h2" }: { children: React.ReactNode; className?: string; as?: "h2" | "h3" }) {
  return <As className={cn("mb-3 text-sm font-semibold uppercase tracking-wide text-subtle", className)}>{children}</As>;
}

/** Circular score indicator. Score text is always visible; colour is not the only signal. */
export function ScoreRing({ score, size = 72, label }: { score: number | null; size?: number; label: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = score === null ? "var(--subtle)" : score >= 80 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" />
      </svg>
      <span className="ltr-isolate absolute text-lg font-semibold tabular-nums">{score === null ? "—" : score}</span>
    </div>
  );
}
