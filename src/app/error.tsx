"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <PageContainer>
      <EmptyState title={t("errorTitle")} description={t("errorBody")} action={<Button onClick={reset}>{t("tryAgain")}</Button>} />
    </PageContainer>
  );
}
