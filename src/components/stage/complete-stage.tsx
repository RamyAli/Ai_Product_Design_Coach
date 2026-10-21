"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { completeStageAction } from "@/app/actions/stages";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CompleteStageButton({ stageId, eligible, nextHref }: { stageId: string; eligible: boolean; nextHref: string | null }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={!eligible || pending}
      aria-disabled={!eligible}
      onClick={() =>
        start(async () => {
          const res = await completeStageAction(stageId);
          if (res.ok) {
            toast.push(t("stageCompleted"), "success");
            if (nextHref) router.push(nextHref);
            router.refresh();
          } else toast.push(res.error.message, "error");
        })
      }
    >
      <CheckCircle2 aria-hidden />
      {t("completeStage")}
    </Button>
  );
}
