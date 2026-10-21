import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { DecisionBadge, MockBadge, StageStatusBadge } from "@/components/common/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { stageTitle } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { computeLearningProgress, computeProjectProgress } from "@/server/services/progress";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("progress") };
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-subtle">{label}</p>
      <p className="ltr-isolate mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
    </Card>
  );
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ project?: string; demo?: string }> }) {
  const t = await getTranslations("progress");
  const te = await getTranslations("enums");
  const locale = await getAppLocale();
  const sp = await searchParams;
  const projects = await db.project.findMany({ where: { status: { not: "archived" } }, orderBy: [{ lastOpenedAt: "desc" }], select: { id: true, title: true } });
  const anyReal = (await db.review.count({ where: { isMock: false } })) > 0;
  const includeDemo = sp.demo === "1" || !anyReal;
  const learning = await computeLearningProgress({ includeDemo });
  const selectedId = projects.find((p) => p.id === sp.project)?.id ?? projects[0]?.id;
  const project = selectedId ? await computeProjectProgress(selectedId) : null;
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { project: selectedId, demo: sp.demo, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/progress?${p.toString()}`;
  };

  if (projects.length === 0) {
    return (
      <PageContainer>
        <PageHeader title={t("title")} description={t("subtitle")} />
        <EmptyState icon={<BarChart3 />} title={t("emptyTitle")} description={t("emptyBody")} />
      </PageContainer>
    );
  }
  const maxTheme = Math.max(1, ...learning.themes.map((x) => x.count));
  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {learning.demoReviewCount > 0 ? (
        <Alert tone="warning" className="mb-4" action={anyReal ? <Link className="text-sm text-primary hover:underline" href={qs({ demo: includeDemo ? undefined : "1" })}>{includeDemo ? t("excludeDemo") : t("includeDemo")}</Link> : undefined}>
          {includeDemo ? t("demoIncluded", { count: learning.demoReviewCount }) : t("demoExcluded", { count: learning.demoReviewCount })}
        </Alert>
      ) : null}

      <section aria-labelledby="overall" className="mb-8">
        <h2 id="overall" className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
          {t("overall")}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={t("stagesCompleted")} value={learning.stagesCompleted} />
          <Stat label={t("reviews")} value={learning.reviewCount} />
          <Stat label={t("avgScore")} value={learning.averageScore ?? "—"} hint={t("avgScoreHint")} />
          <Stat label={t("passRate")} value={learning.passRate === null ? "—" : `${learning.passRate}%`} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("skills")}</CardTitle>
              <p className="text-xs text-subtle">{t("skillsHint")}</p>
            </CardHeader>
            <CardContent>
              {learning.skills.length === 0 ? (
                <p className="text-sm text-muted">{t("noData")}</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {learning.skills.map((s) => (
                    <li key={s.skill} className="text-sm">
                      <div className="mb-1 flex justify-between">
                        <span>{te(`skill.${s.skill}`)}</span>
                        <span className="ltr-isolate tabular-nums text-muted">{s.average}</span>
                      </div>
                      <Progress value={s.average} label={t("skillScore", { skill: te(`skill.${s.skill}`), score: s.average })} tone={s.average >= 80 ? "success" : s.average >= 60 ? "warning" : "primary"} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("themes")}</CardTitle>
              <p className="text-xs text-subtle">{t("themesHint")}</p>
            </CardHeader>
            <CardContent>
              {learning.themes.length === 0 ? (
                <p className="text-sm text-muted">{t("noData")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {learning.themes.slice(0, 8).map((th) => (
                    <li key={th.theme} className="flex items-center gap-3 text-sm">
                      <span className="w-40 shrink-0 truncate">{te(`theme.${th.theme}`)}</span>
                      <span className="h-2 rounded-full bg-warning/70" style={{ width: `${(th.count / maxTheme) * 60}%` }} aria-hidden />
                      <span className="ltr-isolate text-xs tabular-nums text-muted">{th.count}</span>
                    </li>
                  ))}
                </ul>
              )}
              {learning.weakest.length ? (
                <p className="mt-4 text-sm">
                  <span className="font-medium">{t("focusNext")}: </span>
                  {learning.weakest.map((w) => te(`skill.${w.skill}`)).join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
        {learning.timeline.length ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-1 overflow-x-auto" role="list" aria-label={t("timeline")}>
                {learning.timeline.map((p) => (
                  <Link
                    key={p.id}
                    role="listitem"
                    href={`/projects/${p.projectId}/reviews/${p.id}`}
                    className={cn("w-4 shrink-0 rounded-t", p.decision === "pass" ? "bg-success" : p.decision === "revise" ? "bg-warning" : "bg-info", p.isMock && "opacity-50")}
                    style={{ height: `${Math.max(4, p.score)}%` }}
                    title={`${p.score} · ${stageTitle(p.stageKey, locale)} · ${formatDate(p.date, locale)}`}
                    aria-label={t("timelinePoint", { score: p.score, date: formatDate(p.date, locale) })}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section aria-labelledby="project-progress">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="project-progress" className="text-sm font-semibold uppercase tracking-wide text-subtle">
            {t("projectProgress")}
          </h2>
          <nav aria-label={t("chooseProject")} className="flex flex-wrap gap-1">
            {projects.map((p) => (
              <Link key={p.id} href={qs({ project: p.id })} aria-current={p.id === selectedId ? "page" : undefined} className="max-w-56 truncate rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary">
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
        {project ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={t("completion")} value={`${project.completionPercent}%`} hint={t("completionHint", { done: project.completedCount, total: project.totalStages })} />
              <Stat label={t("submissions")} value={project.submissionCount} hint={t("revisions", { count: project.revisionCount })} />
              <Stat label={t("latestAvg")} value={project.averageLatestScore ?? "—"} hint={project.includesMockReviews ? t("includesDemoShort") : t("qualityHint")} />
              <Stat label={t("openTasks")} value={project.openRevisionTasks} />
            </div>
            <p className="text-xs text-subtle">{t("progressVsQuality")}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("stages")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-2 text-sm">
                    {project.stages.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-2">
                        <span className="ltr-isolate w-4 text-subtle">{s.orderIndex}</span>
                        <span className="min-w-0 flex-1 truncate">{stageTitle(s.stageKey, locale)}</span>
                        <StageStatusBadge status={s.status} />
                        {s.latestScore !== null && s.latestDecision ? (
                          <>
                            <span className="ltr-isolate font-semibold tabular-nums">{s.latestScore}</span>
                            <DecisionBadge decision={s.latestDecision} />
                            {s.latestIsMock ? <MockBadge /> : null}
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("projectStrengths")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm">
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("strongest")}</h3>
                    {project.skills.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {project.skills.slice(0, 3).map((s) => (
                          <Badge key={s.skill} variant="success">
                            {te(`skill.${s.skill}`)} · <span className="ltr-isolate">{s.average}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">{t("noData")}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("improve")}</h3>
                    {project.improvementAreas.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {project.improvementAreas.map((s) => (
                          <Badge key={s.skill} variant="warning">
                            {te(`skill.${s.skill}`)} · <span className="ltr-isolate">{s.average}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">{t("noneBelow")}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("repeatedThemes")}</h3>
                    {project.repeatedThemes.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {project.repeatedThemes.map((th) => (
                          <Badge key={th.theme} variant="outline">
                            {te(`theme.${th.theme}`)} · <span className="ltr-isolate">{th.count}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted">{t("noRepeated")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </section>
    </PageContainer>
  );
}
