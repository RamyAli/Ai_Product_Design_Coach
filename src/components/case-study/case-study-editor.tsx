"use client";

import { Download, Eye, PenLine, RefreshCcw, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { draftCaseStudyAction, saveCaseStudyAction } from "@/app/actions/data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Markdown } from "@/components/ui/markdown";
import { Alert, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useJob } from "@/hooks/use-job";
import { cn } from "@/lib/utils";

export function CaseStudyEditor({ projectId, initial, source, pendingJobId }: { projectId: string; initial: string | null; source: string | null; pendingJobId: string | null }) {
  const t = useTranslations("caseStudy");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [markdown, setMarkdown] = useState(initial ?? "");
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("preview");
  const [jobId, setJobId] = useState<string | null>(pendingJobId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!dirty) setMarkdown(initial ?? "");
  }, [initial, dirty]);

  const { active } = useJob(jobId, {
    onDone: (j) => {
      setJobId(null);
      if (j.status === "succeeded") {
        setDirty(false);
        toast.push(t("drafted"), "success");
      } else toast.push(j.errorMessage ?? t("draftFailed"), "error");
      router.refresh();
    },
  });

  const generate = () => {
    setConfirmOpen(false);
    start(async () => {
      const res = await draftCaseStudyAction(projectId);
      if (res.ok) setJobId(res.data.jobId);
      else toast.push(res.error.message, "error");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => (initial ? setConfirmOpen(true) : generate())} disabled={active || pending}>
          {active ? <Spinner /> : initial ? <RefreshCcw aria-hidden /> : <Sparkles aria-hidden />}
          {initial ? t("regenerate") : t("generate")}
        </Button>
        {initial !== null || markdown ? (
          <>
            <Button
              variant="outline"
              disabled={!dirty || pending}
              onClick={() =>
                start(async () => {
                  const res = await saveCaseStudyAction(projectId, markdown);
                  if (res.ok) {
                    setDirty(false);
                    toast.push(t("saved"), "success");
                    router.refresh();
                  } else toast.push(res.error.message, "error");
                })
              }
            >
              <Save aria-hidden />
              {t("save")}
            </Button>
            {initial !== null ? (
              <Button asChild variant="ghost">
                <a href={`/api/projects/${projectId}/case-study`} download>
                  <Download aria-hidden />
                  {t("export")}
                </a>
              </Button>
            ) : null}
          </>
        ) : null}
        {dirty ? <span className="text-xs text-warning">{t("unsaved")}</span> : null}
      </div>
      {active ? (
        <Alert tone="info" role="status" title={t("drafting")}>
          {t("draftingBody")}
        </Alert>
      ) : null}
      {source === "mock" ? <Alert tone="warning">{t("mockNote")}</Alert> : null}
      {initial === null && !active ? (
        <Alert tone="info" title={t("howTitle")}>
          {t("howBody")}
        </Alert>
      ) : null}
      {initial !== null ? (
        <Card>
          <CardContent className="pt-4">
            <div role="group" aria-label={t("viewMode")} className="mb-3 inline-flex rounded-md bg-surface-muted p-0.5">
              <button type="button" aria-pressed={mode === "write"} onClick={() => setMode("write")} className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", mode === "write" ? "bg-surface shadow-sm" : "text-muted")}>
                <PenLine className="size-3.5" aria-hidden />
                {t("edit")}
              </button>
              <button type="button" aria-pressed={mode === "preview"} onClick={() => setMode("preview")} className={cn("inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", mode === "preview" ? "bg-surface shadow-sm" : "text-muted")}>
                <Eye className="size-3.5" aria-hidden />
                {t("preview")}
              </button>
            </div>
            {mode === "write" ? (
              <>
                <label htmlFor="case-study-md" className="sr-only">
                  {t("edit")}
                </label>
                <Textarea
                  id="case-study-md"
                  dir="auto"
                  rows={28}
                  className="font-mono text-[13px]"
                  value={markdown}
                  onChange={(e) => {
                    setMarkdown(e.target.value);
                    setDirty(true);
                  }}
                />
              </>
            ) : (
              <Markdown className="max-w-3xl">{markdown}</Markdown>
            )}
          </CardContent>
        </Card>
      ) : null}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogTitle>{t("regenerateTitle")}</DialogTitle>
          <DialogDescription>{t("regenerateBody")}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={generate}>{t("regenerate")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
