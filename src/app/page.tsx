import { ArrowRight, CalendarDays, CheckCircle2, Clock, FileText, Loader2, Plus, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { LoadSampleButton } from "@/components/common/sample-button";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { StatCard } from "@/components/dashboard/stat-card";
import { DecisionBadge, MockBadge, StageStatusBadge } from "@/components/common/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { getAppLocale } from "@/i18n/request";
import { stageTitle } from "@/domain/stages/definitions";
import { formatDate, formatDateTime } from "@/lib/format";
import { getProviderStatus } from "@/server/ai";
import { activityByDay, computeLearningProgress, getDashboardData } from "@/server/services/progress";
import { getSettings } from "@/server/settings";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const te = await getTranslations("enums");
  const locale = await getAppLocale();
  const [data, settings, status] = await Promise.all([getDashboardData(), getSettings(), getProviderStatus()]);
  const [learning, activity] = await Promise.all([computeLearningProgress({ includeDemo: true }), activityByDay(26)]);
  const hasProjects = data.active.length + data.completed.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title={settings.displayName ? t("welcomeNamed", { name: settings.displayName }) : t("welcome")}
        description={t("subtitle")}
        meta={
          <>
            <CalendarDays aria-hidden />
            {formatDate(new Date(), locale, { dateStyle: "full" })}
          </>
        }
        actions={
          <>
            {data.lastActive ? (
              <Button asChild variant="outline">
                <Link href={data.lastActive.currentStage ? `/projects/${data.lastActive.id}/stages/${data.lastActive.currentStage.id}` : `/projects/${data.lastActive.id}`}>
                  <RotateCcw aria-hidden />
                  {t("continueLast")}
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/projects/new">
                <Plus aria-hidden />
                {t("createProject")}
              </Link>
            </Button>
          </>
        }
      />

      {!status.realProviderReady ? (
        <Alert
          tone="warning"
          className="mb-6"
          title={t("demoTitle")}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/settings#ai">{t("setupAi")}</Link>
            </Button>
          }
        >
          {t("demoBody")}
        </Alert>
      ) : null}

      {!hasProjects ? (
        <EmptyState
          icon={<Sparkles />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/projects/new">{t("generateFirst")}</Link>
              </Button>
              <LoadSampleButton />
            </div>
          }
        />
      ) : (
        <>
        <section aria-label={t("kpis")} className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("kpiActive")}
            hint={t("kpiActiveHint")}
            value={data.active.length}
            tag={t("kpiCompletedTag", { count: data.completed.length })}
            tagTone={data.completed.length ? "success" : "neutral"}
          />
          <StatCard label={t("kpiStages")} hint={t("kpiStagesHint")} value={learning.stagesCompleted} context={t("kpiStagesContext")} />
          <StatCard
            label={t("avgScore")}
            hint={t("kpiScoreHint")}
            value={learning.averageScore ?? "—"}
            tag={learning.passRate === null ? undefined : t("kpiPassRate", { rate: learning.passRate })}
            tagTone={learning.passRate === null ? "neutral" : learning.passRate >= 50 ? "success" : "danger"}
            context={learning.demoReviewCount > 0 ? t("includesDemo", { count: learning.demoReviewCount }) : t("kpiReviewsContext", { count: learning.reviewCount })}
          />
          <StatCard
            label={t("kpiOpenTasks")}
            hint={t("kpiOpenTasksHint")}
            value={learning.openTasks}
            tag={data.revisionRequests.length ? t("kpiStagesNeedRevision", { count: data.revisionRequests.length }) : undefined}
            tagTone="danger"
          />
        </section>
        <div className="mb-6">
          <ActivityHeatmap days={activity} locale={locale} />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <section aria-labelledby="active-heading">
              <h2 id="active-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                {t("activeProjects")}
              </h2>
              {data.active.length === 0 ? (
                <p className="text-sm text-muted">{t("noActive")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.active.map((p) => (
                    <Card key={p.id} className="flex flex-col">
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.status === "draft" ? <Badge>{te("projectStatus.draft")}</Badge> : null}
                          {p.isSample ? <Badge variant="warning">{t("sample")}</Badge> : null}
                        </div>
                        <CardTitle as="h3" className="line-clamp-2" dir="auto">
                          <Link href={`/projects/${p.id}`} className="hover:underline">
                            {p.title}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="mt-auto flex flex-col gap-3">
                        {p.currentStage ? (
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-muted">{t("stageOf", { n: p.currentStage.orderIndex, total: p.totalStages })}</span>
                            <span className="font-medium">{stageTitle(p.currentStage.stageKey, locale)}</span>
                            <StageStatusBadge status={p.currentStage.status} />
                          </div>
                        ) : null}
                        <div className="flex items-center gap-3">
                          <Progress value={(p.completedStages / Math.max(1, p.totalStages)) * 100} label={t("stagesCompleteLabel", { done: p.completedStages, total: p.totalStages })} />
                          <span className="ltr-isolate shrink-0 text-xs tabular-nums text-muted">
                            {p.completedStages}/{p.totalStages}
                          </span>
                        </div>
                        <Button asChild size="sm" variant="secondary" className="self-start">
                          <Link href={p.currentStage ? `/projects/${p.id}/stages/${p.currentStage.id}` : `/projects/${p.id}`}>
                            {t("open")}
                            <ArrowRight className="rtl:rotate-180" aria-hidden />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="recent-heading">
              <h2 id="recent-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                {t("recentSubmissions")}
              </h2>
              {data.recentSubmissions.length === 0 ? (
                <p className="text-sm text-muted">{t("noSubmissions")}</p>
              ) : (
                <Card>
                  <ul className="divide-y divide-border">
                    {data.recentSubmissions.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                        <FileText className="size-4 text-subtle" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {stageTitle(s.stageKey, locale)} · {t("version", { n: s.versionNumber ?? 0 })}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {s.projectTitle} · {formatDateTime(s.submittedAt, locale)}
                          </p>
                        </div>
                        {s.review ? (
                          <Link href={`/projects/${s.projectId}/reviews/${s.review.id}`} className="flex items-center gap-2">
                            <span className="ltr-isolate font-semibold tabular-nums">{s.review.overallScore}</span>
                            <DecisionBadge decision={s.review.decision} />
                            {s.review.isMock ? <MockBadge /> : null}
                          </Link>
                        ) : (
                          <Badge variant="info">{t("awaitingReview")}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </section>

            {data.completed.length ? (
              <section aria-labelledby="completed-heading">
                <h2 id="completed-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
                  {t("completedProjects")}
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.completed.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-muted">
                        <CheckCircle2 className="size-4 text-success" aria-hidden />
                        <span className="truncate" dir="auto">{p.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("pendingReviews")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.pendingReviews.length === 0 && data.failedReviews.length === 0 ? (
                  <p className="text-sm text-muted">{t("noPending")}</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {data.pendingReviews.map((j) => (
                      <li key={j.jobId}>
                        <Link href={`/projects/${j.projectId}/stages/${j.stageId}`} className="flex items-center gap-2 hover:underline">
                          <Loader2 className="size-4 animate-spin text-info" aria-hidden />
                          <span className="truncate">
                            {stageTitle(j.stageKey, locale)} · {j.projectTitle}
                          </span>
                        </Link>
                      </li>
                    ))}
                    {data.failedReviews.map((j) => (
                      <li key={j.jobId}>
                        <Link href={`/projects/${j.projectId}/stages/${j.stageId}`} className="flex items-start gap-2 text-danger hover:underline">
                          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span>
                            {t("reviewFailed", { stage: stageTitle(j.stageKey, locale) })}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("revisionRequests")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.revisionRequests.length === 0 ? (
                  <p className="text-sm text-muted">{t("noRevisions")}</p>
                ) : (
                  <ul className="flex flex-col gap-3 text-sm">
                    {data.revisionRequests.map((r) => (
                      <li key={r.stageId} className="flex flex-col gap-1">
                        <Link href={`/projects/${r.projectId}/stages/${r.stageId}`} className="font-medium hover:underline">
                          {stageTitle(r.stageKey, locale)}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="truncate">{r.projectTitle}</span>
                          <StageStatusBadge status={r.status} />
                          {r.openTasks ? <span>{t("openTasks", { count: r.openTasks })}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("learningSnapshot")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {learning.reviewCount === 0 ? (
                  <p className="text-muted">{t("noLearning")}</p>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-xs text-subtle">{t("avgScore")}</dt>
                        <dd className="ltr-isolate text-xl font-semibold tabular-nums">{learning.averageScore ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-subtle">{t("reviews")}</dt>
                        <dd className="ltr-isolate text-xl font-semibold tabular-nums">{learning.reviewCount}</dd>
                      </div>
                    </dl>
                    {learning.demoReviewCount > 0 ? <p className="text-xs text-warning">{t("includesDemo", { count: learning.demoReviewCount })}</p> : null}
                    {learning.recentThemes.length ? (
                      <div>
                        <p className="mb-1.5 text-xs text-subtle">{t("recentThemes")}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {learning.recentThemes.map((th) => (
                            <Badge key={th.theme} variant="outline">
                              {te(`theme.${th.theme}`)} · <span className="ltr-isolate">{th.count}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
                <Link href="/progress" className="text-primary hover:underline">
                  {t("viewProgress")}
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
        </>
      )}
    </PageContainer>
  );
}
