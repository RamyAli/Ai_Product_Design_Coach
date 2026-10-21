import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ExternalLink, FileText, Lock, PenSquare, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { DecisionBadge, MockBadge, SeverityBadge, StageStatusBadge } from "@/components/common/status";
import { MentorChat } from "@/components/mentor/mentor-chat";
import { PracticeModeToggle } from "@/components/projects/project-header-actions";
import { CompleteStageButton } from "@/components/stage/complete-stage";
import { NewVersionButton } from "@/components/stage/new-version-button";
import { ReviewProgress } from "@/components/stage/review-progress";
import { TaskChecklist } from "@/components/stage/task-checklist";
import { TemplateBlock } from "@/components/stage/template-block";
import { WorkspaceShell } from "@/components/stage/workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Progress, ScoreRing } from "@/components/ui/misc";
import { lt } from "@/domain/localized";
import { getStageDefinition } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getStageWorkspace } from "@/server/services/workspace";

export default async function StageWorkspacePage({ params }: { params: Promise<{ projectId: string; stageId: string }> }) {
  const { projectId, stageId } = await params;
  const ws = await getStageWorkspace(projectId, stageId);
  if (!ws) notFound();
  const t = await getTranslations("workspace");
  const te = await getTranslations("enums");
  const locale = await getAppLocale();
  const { stage, project, definition: def, rubric, customization, latestReview, latestStored, gate } = ws;
  const base = `/projects/${project.id}`;
  const deliverableStatus = new Map(latestStored?.deliverables.map((d) => [d.id, d.status]) ?? []);
  const criterionScore = new Map(latestStored?.criteria.map((c) => [c.id, c.score]) ?? []);
  const openTasks = latestReview?.revisionTasks.filter((r) => r.status === "open") ?? [];
  const completedCount = ws.allStages.filter((s) => s.status === "completed").length;
  const stageNoteFor = (id: string) => customization?.deliverableNotes.find((n) => n.deliverableId === id)?.note;

  const left = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle as="h2" className="text-sm">
            {t("stages")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Progress value={(completedCount / ws.allStages.length) * 100} label={t("projectProgress", { done: completedCount, total: ws.allStages.length })} />
            <span className="ltr-isolate shrink-0 text-xs tabular-nums text-muted">
              {completedCount}/{ws.allStages.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          <ol className="flex flex-col">
            {ws.allStages.map((s) => {
              const Icon = s.status === "completed" ? CheckCircle2 : s.status === "locked" ? Lock : Circle;
              const current = s.id === stage.id;
              return (
                <li key={s.id}>
                  <Link
                    href={`${base}/stages/${s.id}`}
                    aria-current={current ? "page" : undefined}
                    className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm", current ? "bg-primary-soft font-medium text-primary" : "hover:bg-surface-muted")}
                  >
                    <Icon className={cn("size-4 shrink-0", s.status === "completed" ? "text-success" : s.status === "locked" ? "text-subtle" : "text-primary")} aria-hidden />
                    <span className="ltr-isolate w-4 shrink-0 text-xs text-subtle tabular-nums">{s.orderIndex}</span>
                    <span className="min-w-0 flex-1 truncate">{lt(getStageDefinition(s.stageKey).title, locale)}</span>
                    <span className="sr-only">{te(`stageStatus.${s.status}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle as="h2" className="text-sm">
            {t("checklist")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskChecklist
            tasks={stage.tasks.map((task) => ({
              id: task.id,
              title: task.taskKey ? lt(def.tasks.find((d) => d.key === task.taskKey)?.title ?? task.title, locale) : task.title,
              description: task.description,
              isMandatory: task.isMandatory,
              status: task.status,
              taskType: task.taskType,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );

  const main = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t("stageOf", { n: stage.orderIndex, total: ws.allStages.length })}</p>
          <h2 className="text-2xl font-semibold tracking-tight">{lt(def.title, locale)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StageStatusBadge status={stage.status} />
            {project.practiceMode ? <Badge variant="info">{t("practiceMode")}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ws.canWork ? (
            <Button asChild>
              <Link href={`${base}/stages/${stage.id}/submit`}>
                <PenSquare aria-hidden />
                {ws.draft ? t("continueDraft") : ws.versions.length ? t("newVersion") : t("startSubmission")}
              </Link>
            </Button>
          ) : null}
          {latestReview ? (
            <Button asChild variant="outline">
              <Link href={`${base}/reviews/${latestReview.id}`}>{t("viewReview")}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {!ws.canWork ? (
        <Alert tone="warning" title={t("lockedTitle")}>
          <p>{t("lockedBody")}</p>
          <div className="mt-3 max-w-md">
            <PracticeModeToggle projectId={project.id} enabled={project.practiceMode} />
          </div>
        </Alert>
      ) : null}
      {stage.status === "needs_revalidation" ? (
        <Alert tone="danger" title={t("revalidationTitle")}>
          {t("revalidationBody", { reason: stage.revalidationReason ?? "" })}
        </Alert>
      ) : null}
      {ws.reviewJob ? (
        <ReviewProgress
          key={ws.reviewJob.id}
          jobId={ws.reviewJob.id}
          initialStatus={ws.reviewJob.status}
          errorMessage={ws.reviewJob.errorMessage}
          submissionId={ws.reviewJob.submissionId}
        />
      ) : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("objective")}</h3>
            <p className="text-sm">{lt(def.objective, locale)}</p>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("whyItMatters")}</h3>
            <p className="text-sm">{lt(def.whyItMatters, locale)}</p>
          </div>
          <div className="md:col-span-2">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("expectedDepth", { level: te(`difficulty.${project.difficulty}`) })}</h3>
            <p className="text-sm text-muted">{lt(def.depthGuidance[project.difficulty as "easy" | "medium" | "hard"], locale)}</p>
          </div>
          {customization?.focus ? (
            <div className="rounded-md bg-primary-soft p-3 md:col-span-2">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{t("projectFocus")}</h3>
              <p className="text-sm">{customization.focus}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("deliverables")}</CardTitle>
          <p className="text-sm text-muted">{t("deliverablesHint")}</p>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {rubric.deliverables.map((d) => {
              const status = deliverableStatus.get(d.id);
              return (
                <li key={d.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {lt(d.title, locale)}
                      {d.mandatory ? <Badge variant="outline">{t("required")}</Badge> : <Badge>{t("optional")}</Badge>}
                      <Badge>{te(`evidence.${d.evidence}`)}</Badge>
                    </p>
                    <p className="text-sm text-muted">{lt(d.description, locale)}</p>
                    {stageNoteFor(d.id) ? <p className="mt-1 text-xs text-primary">{stageNoteFor(d.id)}</p> : null}
                  </div>
                  {status ? (
                    <Badge variant={status === "provided" ? "success" : status === "partial" ? "warning" : status === "missing" ? "danger" : "info"}>
                      {te(`deliverableStatus.${status}`)}
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("methods")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-wrap gap-2">
            {def.methods.map((m, i) => (
              <li key={i}>
                <Badge variant="outline">{lt(m, locale)}</Badge>
              </li>
            ))}
          </ul>
          {def.templates.map((tpl) => (
            <TemplateBlock key={tpl.id} title={lt(tpl.title, locale)} body={lt(tpl.body, project.preferredLanguage as "en" | "ar")} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {ws.draft ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border-strong p-3 text-sm">
              <FileText className="size-4 text-subtle" aria-hidden />
              <span className="flex-1">{t("draftSaved", { date: formatDateTime(ws.draft.updatedAt, locale), files: ws.draft._count.assets })}</span>
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/stages/${stage.id}/submit`}>{t("openDraft")}</Link>
              </Button>
            </div>
          ) : null}
          {ws.versions.length === 0 ? (
            <p className="text-sm text-muted">{t("noVersions")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {ws.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="ltr-isolate w-10 font-semibold">v{v.versionNumber}</span>
                  <span className="flex-1 text-muted">
                    {formatDateTime(v.submittedAt, locale)} · {t("files", { count: v._count.assets })}
                  </span>
                  {v.reviews[0] ? (
                    <Link href={`${base}/reviews/${v.reviews[0].id}`} className="flex items-center gap-2 hover:underline">
                      <span className="ltr-isolate font-semibold tabular-nums">{v.reviews[0].overallScore}</span>
                      <DecisionBadge decision={v.reviews[0].decision} />
                      {v.reviews[0].isMock ? <MockBadge /> : null}
                    </Link>
                  ) : (
                    <Badge variant="info">{t("notReviewed")}</Badge>
                  )}
                  {!ws.draft && ws.canWork ? <NewVersionButton stageId={stage.id} fromSubmissionId={v.id} href={`${base}/stages/${stage.id}/submit`} /> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={gate.eligible ? "border-success/50" : undefined}>
        <CardHeader>
          <CardTitle>{t("completion")}</CardTitle>
          <p className="text-sm text-muted">{t("completionHint", { threshold: latestStored?.threshold ?? rubric.passThreshold })}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {stage.status === "completed" ? (
            <Alert tone="success" title={t("completedTitle")}>
              {t("completedBody")}
            </Alert>
          ) : gate.eligible ? (
            <Alert tone="success" title={t("eligibleTitle")}>
              {t("eligibleBody")}
            </Alert>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {gate.blockers.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
                  {t(`blocker.${b.code}`, { count: b.count ?? 0, decision: b.detail ? te(`decision.${b.detail}`) : "" })}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            {stage.status !== "completed" ? (
              <CompleteStageButton stageId={stage.id} eligible={gate.eligible} nextHref={ws.nextStage ? `${base}/stages/${ws.nextStage.id}` : `${base}/case-study`} />
            ) : null}
            {stage.status === "completed" && ws.nextStage ? (
              <Button asChild variant="outline">
                <Link href={`${base}/stages/${ws.nextStage.id}`}>
                  {t("goNext")}
                  <ArrowRight className="rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        {ws.previousStage ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`${base}/stages/${ws.previousStage.id}`}>
              <ArrowLeft className="rtl:rotate-180" aria-hidden />
              {t("previousStage")}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {ws.nextStage ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`${base}/stages/${ws.nextStage.id}`}>
              {t("nextStage")}
              <ArrowRight className="rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );

  const right = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle as="h2" className="text-sm">
            {t("latestFeedback")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {latestReview && latestStored ? (
            <>
              <div className="flex items-center gap-3">
                <ScoreRing score={latestReview.overallScore} size={60} label={t("scoreLabel", { score: latestReview.overallScore })} />
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap gap-1">
                    <DecisionBadge decision={latestReview.decision} />
                    {latestReview.isMock ? <MockBadge /> : null}
                  </div>
                  <span className="text-xs text-subtle">
                    v{latestReview.submission.versionNumber} · {formatDateTime(latestReview.createdAt, locale)}
                  </span>
                </div>
              </div>
              <p className="line-clamp-4 text-sm text-muted">{latestReview.summary}</p>
              {openTasks.length ? (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">{t("openRevisionTasks", { count: openTasks.length })}</h3>
                  <ul className="flex flex-col gap-1.5">
                    {openTasks.slice(0, 5).map((r) => (
                      <li key={r.id} className="flex items-start gap-2 text-sm">
                        <SeverityBadge severity={r.severity} />
                        <span className="min-w-0">{r.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {latestStored.nextSteps.length ? (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">{t("nextSteps")}</h3>
                  <ul className="list-disc ps-5 text-sm">
                    {latestStored.nextSteps.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Link href={`${base}/reviews/${latestReview.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                {t("openFullReview")}
                <ExternalLink className="size-3.5" aria-hidden />
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted">{t("noFeedback")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle as="h2" className="text-sm">
            {t("criteria")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5">
            {rubric.criteria.map((c) => {
              const score = criterionScore.get(c.id);
              return (
                <li key={c.id} className="text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      {lt(c.name, locale)}
                      {c.mandatory ? <span className="ms-1 text-xs text-danger" title={t("mandatoryCriterion")}>*</span> : null}
                    </span>
                    <span className="ltr-isolate shrink-0 text-xs tabular-nums text-subtle">
                      {score === undefined ? `${c.weight}%` : score === null ? "n/a" : `${score} · ${c.weight}%`}
                    </span>
                  </div>
                  <p className="text-xs text-subtle">{lt(c.description, locale)}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-subtle">{t("criteriaLegend")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <MentorChat
            projectId={project.id}
            stageId={stage.id}
            initialMessages={ws.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, isMock: m.isMock }))}
            pendingJobId={ws.mentorJobId}
          />
        </CardContent>
      </Card>
      {stage.status === "completed" ? (
        <p className="flex items-center gap-1.5 text-xs text-subtle">
          <RefreshCcw className="size-3.5" aria-hidden />
          {t("revisitNote")}
        </p>
      ) : null}
    </div>
  );

  return (
    <PageContainer wide>
      <WorkspaceShell left={left} main={main} right={right} />
    </PageContainer>
  );
}
