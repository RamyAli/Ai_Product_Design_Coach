"use client";

import { CopyPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { startDraftFromVersionAction } from "@/app/actions/submissions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

export function StartFromVersion({ stageId, submissionId, versionNumber }: { stageId: string; submissionId: string; versionNumber: number }) {
  const t = useTranslations("submission");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Alert
      tone="info"
      className="mb-4"
      title={t("startFromTitle", { n: versionNumber })}
      action={
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await startDraftFromVersionAction(stageId, submissionId);
              if (res.ok) router.refresh();
              else toast.push(res.error.message, "error");
            })
          }
        >
          <CopyPlus aria-hidden />
          {t("startFrom", { n: versionNumber })}
        </Button>
      }
    >
      {t("startFromBody")}
    </Alert>
  );
}
