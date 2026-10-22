import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { GeneratorWizard } from "@/components/generator/generator-wizard";
import { PageHeader } from "@/components/ui/misc";
import { lt } from "@/domain/localized";
import { STAGE_DEFINITIONS } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { getProviderStatus } from "@/server/ai";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("generate") };
}

export default async function NewProjectPage() {
  const t = await getTranslations("generator");
  const locale = await getAppLocale();
  const status = await getProviderStatus();
  const stageTitles = Object.fromEntries(STAGE_DEFINITIONS.map((d) => [d.key, lt(d.title, locale)]));
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <GeneratorWizard locale={locale} stageTitles={stageTitles} aiReady={status.realProviderReady} />
    </PageContainer>
  );
}
