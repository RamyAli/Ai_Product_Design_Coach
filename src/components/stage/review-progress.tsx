"use client";

import { RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { cancelJobAction } from "@/app/actions/projects";
import { requestReviewAction } from "@/app/actions/submissions";
import { Button } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useJob } from "@/hooks/use-job";

/** Shows a running review, refreshes the page when it completes, and offers retry when it failed. */
export function ReviewProgress({ jobId, initialStatus, errorMessage, submissionId }: { jobId: string; initialStatus: string; errorMessage: string | null; submissionId: string | null }) {
  const t = useTranslations("workspace");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(jobId);
  const watching = initialStatus === "queued" || initialStatus === "running" || current !== jobId;
  const { job } = useJob(watching ? current : null, {
    onDone: (j) => {
      if (j.status === "succeeded") toast.push(t("reviewReady"), "success");
      router.refresh();
    },
  });
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!watching) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [watching]);

  const status = job?.status ?? initialStatus;
  if (status === "failed" || status === "cancelled") {
    return (
      <Alert
        tone="danger"
        role="alert"
        title={status === "cancelled" ? t("reviewCancelled") : t("reviewFailed")}
        action={
          submissionId ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await requestReviewAction(submissionId);
                  if (res.ok) {
                    setCurrent(res.data.jobId);
                    router.refresh();
                  } else toast.push(res.error.message, "error");
                })
              }
            >
              <RotateCcw aria-hidden />
              {t("retryReview")}
            </Button>
          ) : null
        }
      >
        {job?.errorMessage ?? errorMessage ?? t("reviewFailedBody")} {t("workSaved")}
      </Alert>
    );
  }
  return (
    <Alert
      tone="info"
      role="status"
      title={status === "queued" ? t("reviewQueued") : t("reviewRunning")}
      action={
        <Button size="sm" variant="ghost" onClick={() => void cancelJobAction(current)}>
          <X aria-hidden />
          {tc("cancel")}
        </Button>
      }
    >
      <span className="inline-flex items-center gap-2">
        <Spinner />
        {t("reviewRunningBody")} <span className="ltr-isolate tabular-nums">{t("elapsed", { s: elapsed })}</span>
      </span>
    </Alert>
  );
}
