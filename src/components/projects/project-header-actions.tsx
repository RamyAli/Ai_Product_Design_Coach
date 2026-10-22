"use client";

import { FlaskConical, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { activateProjectAction, setPracticeModeAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ActivateProjectButton({ projectId }: { projectId: string }) {
  const t = useTranslations("project");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await activateProjectAction(projectId);
          if (res.ok) router.refresh();
          else toast.push(res.error.message, "error");
        })
      }
    >
      <Play aria-hidden />
      {t("start")}
    </Button>
  );
}

export function PracticeModeToggle({ projectId, enabled }: { projectId: string; enabled: boolean }) {
  const t = useTranslations("project");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
      <input
        type="checkbox"
        role="switch"
        aria-checked={enabled}
        className="mt-0.5 size-4 accent-[var(--primary)]"
        checked={enabled}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const res = await setPracticeModeAction(projectId, e.target.checked);
            if (res.ok) {
              toast.push(e.target.checked ? t("practiceOn") : t("practiceOff"), "info");
              router.refresh();
            } else toast.push(res.error.message, "error");
          })
        }
      />
      <span>
        <span className="flex items-center gap-1.5 font-medium">
          <FlaskConical className="size-4" aria-hidden />
          {t("practiceMode")}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{t("practiceModeHint")}</span>
      </span>
    </label>
  );
}
