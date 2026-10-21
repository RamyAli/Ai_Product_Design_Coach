"use client";

import { Check, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { updateRevisionTaskAction } from "@/app/actions/reviews";
import { SeverityBadge } from "@/components/common/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface RevisionTaskItem {
  id: string;
  title: string;
  description: string;
  reason: string;
  suggestedAction: string;
  severity: string;
  criterionName: string | null;
  theme: string | null;
  status: string;
  resolutionNote: string | null;
}

/** Users manage revision tasks; doing so never alters the review itself. */
export function RevisionTaskList({ tasks, readOnly }: { tasks: RevisionTaskItem[]; readOnly?: boolean }) {
  const t = useTranslations("review");
  const te = useTranslations("enums");
  if (tasks.length === 0) return <p className="text-sm text-muted">{t("noTasks")}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} readOnly={readOnly} t={t} te={te} />
      ))}
    </ul>
  );
}

function TaskRow({ task, readOnly, t, te }: { task: RevisionTaskItem; readOnly?: boolean; t: ReturnType<typeof useTranslations>; te: ReturnType<typeof useTranslations> }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [dismissing, setDismissing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const update = (status: "open" | "completed" | "dismissed", n?: string) =>
    start(async () => {
      const res = await updateRevisionTaskAction(task.id, status, n);
      if (res.ok) {
        setDismissing(false);
        setNote("");
        router.refresh();
      } else {
        setError(res.error.message);
        toast.push(res.error.message, "error");
      }
    });
  const closed = task.status !== "open";
  return (
    <li className={cn("rounded-md border border-border p-3", closed && "bg-surface-muted")} data-testid="revision-task">
      <div className="flex flex-wrap items-start gap-2">
        <SeverityBadge severity={task.severity} />
        <p className={cn("min-w-0 flex-1 text-sm font-medium", closed && "text-muted line-through")} dir="auto">
          {task.title}
        </p>
        {closed ? <Badge variant={task.status === "completed" ? "success" : "neutral"}>{te(`revisionStatus.${task.status}`)}</Badge> : null}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-sm" dir="auto">
        {task.description ? <p>{task.description}</p> : null}
        {task.reason ? (
          <p className="text-muted">
            <span className="font-medium text-foreground">{t("why")}: </span>
            {task.reason === "mandatory_deliverable_missing" ? t("reasonMissingDeliverable") : task.reason}
          </p>
        ) : null}
        {task.suggestedAction && task.suggestedAction !== task.description ? (
          <p className="text-muted">
            <span className="font-medium text-foreground">{t("suggestedAction")}: </span>
            {task.suggestedAction}
          </p>
        ) : null}
        <p className="text-xs text-subtle">
          {task.criterionName ? `${t("criterion")}: ${task.criterionName}` : null}
          {task.theme ? ` · ${te(`theme.${task.theme}`)}` : null}
        </p>
        {task.resolutionNote ? <p className="text-xs text-muted">{t("yourNote")}: {task.resolutionNote}</p> : null}
      </div>
      {!readOnly ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.status === "open" ? (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => update("completed")}>
                <Check aria-hidden />
                {t("markDone")}
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDismissing((d) => !d)} aria-expanded={dismissing}>
                <XCircle aria-hidden />
                {t("dismiss")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => update("open")}>
              <RotateCcw aria-hidden />
              {t("reopen")}
            </Button>
          )}
        </div>
      ) : null}
      {dismissing ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            update("dismissed", note);
          }}
        >
          <Field id={`dismiss-${task.id}`} label={t("dismissReason")} error={error} className="flex-1">
            {(p) => <Input {...p} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <Button type="submit" size="sm" disabled={pending || note.trim().length < 3}>
            {t("confirmDismiss")}
          </Button>
        </form>
      ) : null}
    </li>
  );
}
