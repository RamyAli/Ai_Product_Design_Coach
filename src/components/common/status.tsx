import { AlertOctagon, AlertTriangle, CheckCircle2, CircleDashed, Clock, Eye, Info, Lock, RefreshCcw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

const STAGE_VARIANT: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "outline"> = {
  locked: "neutral",
  available: "outline",
  in_progress: "primary",
  in_review: "info",
  needs_revision: "warning",
  ready_to_complete: "success",
  completed: "success",
  needs_revalidation: "danger",
};
const STAGE_ICON = {
  locked: Lock,
  available: CircleDashed,
  in_progress: Clock,
  in_review: Eye,
  needs_revision: AlertTriangle,
  ready_to_complete: CheckCircle2,
  completed: CheckCircle2,
  needs_revalidation: RefreshCcw,
} as const;

export function StageStatusBadge({ status }: { status: string }) {
  const t = useTranslations("enums.stageStatus");
  const Icon = STAGE_ICON[status as keyof typeof STAGE_ICON] ?? CircleDashed;
  return (
    <Badge variant={STAGE_VARIANT[status] ?? "neutral"}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}

export function DecisionBadge({ decision }: { decision: string }) {
  const t = useTranslations("enums.decision");
  const variant = decision === "pass" ? "success" : decision === "revise" ? "warning" : "info";
  const Icon = decision === "pass" ? CheckCircle2 : decision === "revise" ? AlertTriangle : Search;
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {t(decision)}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const t = useTranslations("enums.severity");
  const variant = severity === "critical" ? "danger" : severity === "major" ? "warning" : severity === "minor" ? "info" : "neutral";
  const Icon = severity === "critical" ? AlertOctagon : severity === "major" ? AlertTriangle : Info;
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {t(severity)}
    </Badge>
  );
}

export function MockBadge() {
  const t = useTranslations("common");
  return <Badge variant="warning">{t("demoReview")}</Badge>;
}
