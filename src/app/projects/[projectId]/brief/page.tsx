import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BriefPageClient } from "@/components/brief/brief-page-client";
import { PageContainer } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lt } from "@/domain/localized";
import { STAGE_DEFINITIONS } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { formatDateTime } from "@/lib/format";
import { db } from "@/server/db";
import { readBrief } from "@/server/services/projects";

export default async function BriefPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await db.project.findUnique({ where: { id: projectId }, include: { briefVersions: { orderBy: { versionNumber: "desc" } } } });
  if (!project) notFound();
  const t = await getTranslations("briefPage");
  const locale = await getAppLocale();
  const { workflow, ...brief } = readBrief(project);
  const stageTitles = Object.fromEntries(STAGE_DEFINITIONS.map((d) => [d.key, lt(d.title, locale)]));
  return (
    <PageContainer wide>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div>
          <h2 className="sr-only">{t("title")}</h2>
          <BriefPageClient projectId={project.id} brief={brief} workflow={workflow} stageTitles={stageTitles} />
        </div>
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>{t("history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3 text-sm">
                {project.briefVersions.map((v) => (
                  <li key={v.id} className="border-s-2 border-border ps-3">
                    <div className="flex items-center gap-2">
                      <span className="ltr-isolate font-semibold">v{v.versionNumber}</span>
                      {v.versionNumber === project.briefVersion ? <Badge variant="primary">{t("current")}</Badge> : null}
                      <Badge variant="outline">{t(`source.${v.source}`)}</Badge>
                    </div>
                    <p className="mt-0.5 text-muted">{v.changeSummary}</p>
                    <p className="text-xs text-subtle">{formatDateTime(v.createdAt, locale)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
