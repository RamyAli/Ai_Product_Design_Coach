"use client";

import { CopyPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { startDraftFromVersionAction } from "@/app/actions/submissions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function NewVersionButton({ stageId, fromSubmissionId, href }: { stageId: string; fromSubmissionId: string; href: string }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await startDraftFromVersionAction(stageId, fromSubmissionId);
          if (res.ok) router.push(href);
          else toast.push(res.error.message, "error");
        })
      }
    >
      <CopyPlus aria-hidden />
      {t("reviseFromThis")}
    </Button>
  );
}
