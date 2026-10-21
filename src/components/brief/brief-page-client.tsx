"use client";

import { PenLine, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { previewBriefImpactAction, retailorStagesAction, updateBriefAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import type { BriefCore, StagePlan } from "@/domain/brief";
import type { BriefImpact } from "@/domain/briefImpact";
import { useJob } from "@/hooks/use-job";
import { BriefEditor } from "./brief-editor";
import { briefToForm, formToBrief } from "./brief-form";
import { BriefView } from "./brief-view";

export function BriefPageClient({
  projectId,
  brief,
  workflow,
  stageTitles,
}: {
  projectId: string;
  brief: BriefCore;
  workflow: StagePlan[];
  stageTitles: Record<string, string>;
}) {
  const t = useTranslations("briefPage");
  const tb = useTranslations("brief");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pendingBrief, setPendingBrief] = useState<Omit<BriefCore, never> | null>(null);
  const [impact, setImpact] = useState<BriefImpact | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState("");
  const [busy, start] = useTransition();
  const [retailorJob, setRetailorJob] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { active: retailoring } = useJob(retailorJob, {
    onDone: (j) => {
      setRetailorJob(null);
      if (j.status === "succeeded") {
        toast.push(t("retailored"), "success");
        router.refresh();
      } else toast.push(j.errorMessage ?? t("retailorFailed"), "error");
    },
  });

  const confirmSave = () => {
    if (!pendingBrief) return;
    start(async () => {
      const res = await updateBriefAction({ projectId, brief: pendingBrief, changeSummary: summary, revalidateStageIds: selected });
      if (res.ok) {
        setImpact(null);
        setPendingBrief(null);
        setEditing(false);
        setSaved(true);
        toast.push(t("saved", { version: res.data.version }), "success");
        router.refresh();
      } else toast.push(res.error.message, "error");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {saved ? (
        <Alert
          tone="info"
          title={t("savedTitle")}
          action={
            <Button size="sm" variant="outline" disabled={retailoring} onClick={() => start(async () => {
              const res = await retailorStagesAction(projectId);
              if (res.ok) setRetailorJob(res.data.jobId);
              else toast.push(res.error.message, "error");
            })}>
              {retailoring ? <Spinner /> : <RefreshCcw aria-hidden />}
              {t("retailor")}
            </Button>
          }
        >
          {t("savedBody")}
        </Alert>
      ) : null}
      {editing ? (
        <BriefEditor
          defaultValues={briefToForm(brief)}
          submitLabel={t("review")}
          busy={busy}
          onSubmit={(values) => {
            const next = formToBrief(values);
            start(async () => {
              const res = await previewBriefImpactAction(projectId, next);
              if (!res.ok) {
                toast.push(res.error.message, "error");
                return;
              }
              if (res.data.changedFields.length === 0) {
                toast.push(t("noChanges"), "info");
                setEditing(false);
                return;
              }
              setPendingBrief(next);
              setImpact(res.data);
              setSelected(res.data.affectedStages.map((s) => s.stageId));
            });
          }}
          secondaryAction={
            <Button variant="outline" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PenLine aria-hidden />
              {t("edit")}
            </Button>
          </div>
          <BriefView brief={brief} workflow={workflow} stageTitles={stageTitles} />
        </>
      )}

      <Dialog open={impact !== null} onOpenChange={(o) => !o && setImpact(null)}>
        <DialogContent closeLabel={tc("close")} className="max-w-xl">
          <DialogTitle>{t("impactTitle")}</DialogTitle>
          <DialogDescription>{t("impactBody", { fields: impact?.changedFields.map((f) => tb(f)).join(", ") ?? "" })}</DialogDescription>
          {impact && impact.affectedStages.length > 0 ? (
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium">{t("affectedStages")}</legend>
              <p className="mb-2 text-xs text-muted">{t("affectedHint")}</p>
              <ul className="flex flex-col gap-2">
                {impact.affectedStages.map((s) => (
                  <li key={s.stageId}>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(s.stageId)}
                        onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, s.stageId] : prev.filter((x) => x !== s.stageId)))}
                      />
                      {stageTitles[s.stageKey] ?? s.stageKey}
                      <span className="text-xs text-subtle">{t("stageWork", { submissions: s.submissionCount, reviews: s.reviewCount })}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("noAffected")}</p>
          )}
          <div className="mt-4">
            <Field id="change-summary" label={t("changeSummary")} optional={tc("optional")}>
              {(p) => <Input {...p} value={summary} maxLength={500} onChange={(e) => setSummary(e.target.value)} />}
            </Field>
          </div>
          <p className="mt-3 text-xs text-subtle">{t("nothingDeleted")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpact(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={confirmSave} disabled={busy}>
              {t("saveVersion")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
