import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { SettingsClient } from "@/components/settings/settings-client";
import { PageHeader } from "@/components/ui/misc";
import { getProviderStatus } from "@/server/ai";
import { getDataPaths, LIMITS } from "@/server/config";
import { db } from "@/server/db";
import { describeSecret } from "@/server/secrets";
import { listBackups } from "@/server/services/backup";
import { getSettings } from "@/server/settings";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const [settings, provider, backups, sampleCount, projects] = await Promise.all([
    getSettings(),
    getProviderStatus(),
    listBackups(),
    db.project.count({ where: { isSample: true } }),
    db.project.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true } }),
  ]);
  const paths = getDataPaths();
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsClient
        settings={settings}
        provider={provider}
        anthropicKey={describeSecret("anthropicApiKey")}
        figmaToken={describeSecret("figmaAccessToken")}
        dataPaths={{ root: paths.root, database: paths.database, uploads: paths.uploads, backups: paths.backups }}
        backups={backups.map((b) => ({ filename: b.filename, sizeBytes: b.sizeBytes, kind: b.kind, createdAt: b.createdAt.toISOString() }))}
        sampleCount={sampleCount}
        hardMaxUploadMb={LIMITS.hardMaxUploadMb}
        envProviderForced={Boolean(process.env.AI_PROVIDER?.trim())}
        projects={projects}
      />
    </PageContainer>
  );
}
