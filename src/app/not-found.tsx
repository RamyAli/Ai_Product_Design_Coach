import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <PageContainer>
      <EmptyState
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          <Button asChild>
            <Link href="/">{t("goHome")}</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
