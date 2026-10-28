"use client";

import { FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { loadSampleProjectAction } from "@/app/actions/data";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function LoadSampleButton({ variant = "outline", size }: Pick<ButtonProps, "variant" | "size">) {
  const t = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await loadSampleProjectAction();
          if (res.ok) {
            toast.push(t("sampleLoaded"), "success");
            router.push("/projects");
          } else toast.push(res.error.message, "error");
        })
      }
    >
      <FlaskConical aria-hidden />
      {t("loadSample")}
    </Button>
  );
}
