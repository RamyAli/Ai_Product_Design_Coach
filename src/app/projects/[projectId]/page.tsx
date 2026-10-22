import { ArrowRight, CheckCircle2, Circle, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { StageStatusBadge } from "@/components/common/status";
import { PracticeModeToggle } from "@/components/projects/project-header-actions";
import { ProjectActions } from "@/components/projects/project-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { detectTextDirection, lt } from "@/domain/localized";
import { getStageDefinition } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { formatDate } from "@/lib/format";
import { db } from "@/server/db";
import { nextActionFor } from "@/server/services/next-action";
import { readBrief } from "@/server/services/projects";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      stages: { orderBy: { orderIndex: "asc" }, include: { _count: { select: { submissions: true, reviews: true } } } },
    },
  });
  if (!project) notFound();
  const t = await getTranslations("overview");
  const locale = await getAppLocale();
  const brief = readBrief(project);
  const done = project.stages.filter((s) => s.status === "completed").length;
  const next = nextActionFor(
    project,
    project.stages.map((s) => ({ id: s.id, title: lt(getStageDefinition(s.stageKey).title, locale), status: s.status, orderIndex: s.orderIndex, hasDraftOrSubmission: s._count.submissions > 0 })),
  );
  const dir = detectTextDirection(brief.summary);
  const d = dir === "auto" ? undefined : dir;

  return (
    <PageContainer wide>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("summary")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4" dir={d}>
              <p className="text-sm">{brief.summary}</p>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("problemStatement")}</h3>
                <p className="text-sm">{brief.problemStatement}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("targetUsers")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {brief.targetUsers.map((u, i) => (
                      <li key={i}>{u.segment}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("focusFeatures")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {brief.focusFeatures.map((f) => (
                      <li key={f.id}>{f.name}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("businessObjectives")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {brief.businessObjectives.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("successMetrics")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {brief.successMetrics.map((m, i) => (
                      <li key={i}>
                        {m.metric}
                        {m.target ? <span className="text-muted"> — {m.target}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("scope")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {brief.inScope.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                  {brief.outOfScope.length ? (
                    <>
                      <h4 className="mb-1 mt-2 text-xs text-subtle">{t("exclusions")}</h4>
                      <ul className="list-disc ps-5 text-sm text-muted">
                        {brief.outOfScope.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("constraints")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {brief.constraints.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div className="sm:col-span-2">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("assumptions")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {brief.assumptions.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link href={`/projects/${project.id}/brief`} className="text-sm text-primary hover:underline">
                {t("fullBrief")}
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col">
                {project.stages.map((s, i) => {
                  const def = getStageDefinition(s.stageKey);
                  const Icon = s.status === "completed" ? CheckCircle2 : s.status === "locked" ? Lock : Circle;
                  return (
                    <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {i < project.stages.length - 1 ? <span className="absolute start-[11px] top-6 h-[calc(100%-1rem)] w-px bg-border" aria-hidden /> : null}
                      <Icon className={`relative mt-0.5 size-6 shrink-0 rounded-full bg-surface p-0.5 ${s.status === "completed" ? "text-success" : s.status === "locked" ? "text-subtle" : "text-primary"}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/projects/${project.id}/stages/${s.id}`} className="font-medium hover:underline">
                            {s.orderIndex}. {lt(def.title, locale)}
                          </Link>
                          <StageStatusBadge status={s.status} />
                        </div>
                        <p className="text-sm text-muted">{lt(def.objective, locale)}</p>
                        <p className="mt-0.5 text-xs text-subtle">
                          {t("deliverablesCount", { count: def.deliverables.filter((x) => x.mandatory).length })}
                          {s.completedAt ? ` · ${t("completedOn", { date: formatDate(s.completedAt, locale) })}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle>{t("nextAction")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm">{t(`next.${next.kind}`, { stage: next.stageTitle ?? "", n: next.stageNumber ?? 0 })}</p>
              {next.kind !== "start_project" ? (
                <Button asChild className="self-start">
                  <Link href={next.href}>
                    {t(`nextCta.${next.kind}`)}
                    <ArrowRight className="rtl:rotate-180" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("status")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-3">
                <Progress value={(done / project.stages.length) * 100} label={t("progressLabel", { done, total: project.stages.length })} />
                <span className="ltr-isolate shrink-0 tabular-nums text-muted">{done}/{project.stages.length}</span>
              </div>
              <p className="text-xs text-subtle">{t("progressNote")}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-subtle">{t("created")}</dt>
                <dd>{formatDate(project.createdAt, locale)}</dd>
                <dt className="text-subtle">{t("briefVersion")}</dt>
                <dd className="ltr-isolate">v{project.briefVersion}</dd>
                <dt className="text-subtle">{t("effort")}</dt>
                <dd>{brief.estimatedEffort}</dd>
              </dl>
            </CardContent>
          </Card>
          <PracticeModeToggle projectId={project.id} enabled={project.practiceMode} />
          <Card>
            <CardHeader>
              <CardTitle>{t("manage")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectActions projectId={project.id} title={project.title} archived={project.status === "archived"} />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
