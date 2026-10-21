import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { DecisionBadge, MockBadge, StageStatusBadge } from "@/components/common/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { lt } from "@/domain/localized";
import { getStageDefinition } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { computeProjectProgress } from "@/server/services/progress";
import { db } from "@/server/db";

export default async function WorkflowPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, practiceMode: true } });
  if (!project) notFound();
  const t = await getTranslations("workflow");
  const locale = await getAppLocale();
  const progress = await computeProjectProgress(projectId);
  return (
    <PageContainer>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted">{project.practiceMode ? t("subtitlePractice") : t("subtitle")}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {progress.stages.map((s) => {
          const def = getStageDefinition(s.stageKey);
          return (
            <li key={s.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="ltr-isolate flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold">{s.orderIndex}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{lt(def.title, locale)}</h3>
                    <StageStatusBadge status={s.status} />
                  </div>
                  <p className="text-sm text-muted">{lt(def.objective, locale)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                    <span>{t("deliverables", { count: def.deliverables.filter((d) => d.mandatory).length })}</span>
                    <span>· {t("versions", { count: s.submissionCount })}</span>
                    {s.latestScore !== null && s.latestDecision ? (
                      <>
                        <span>·</span>
                        <span className="ltr-isolate font-semibold text-foreground">{s.latestScore}</span>
                        <DecisionBadge decision={s.latestDecision} />
                        {s.latestIsMock ? <MockBadge /> : null}
                      </>
                    ) : null}
                    {s.status === "locked" && project.practiceMode ? <Badge variant="info">{t("practiceOpen")}</Badge> : null}
                  </p>
                </div>
                <Button asChild variant={s.status === "locked" && !project.practiceMode ? "ghost" : "outline"} size="sm">
                  <Link href={`/projects/${projectId}/stages/${s.id}`}>
                    {t("open")}
                    <ArrowRight className="rtl:rotate-180" aria-hidden />
                  </Link>
                </Button>
              </Card>
            </li>
          );
        })}
      </ol>
    </PageContainer>
  );
}
