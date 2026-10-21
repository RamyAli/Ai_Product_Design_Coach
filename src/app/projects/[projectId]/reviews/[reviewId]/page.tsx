import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, PenSquare } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { DecisionBadge, MockBadge, SeverityBadge } from "@/components/common/status";
import { MentorChat } from "@/components/mentor/mentor-chat";
import { RevisionTaskList } from "@/components/review/revision-tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, Progress, ScoreRing } from "@/components/ui/misc";
import { SEVERITIES } from "@/domain/enums";
import { lt } from "@/domain/localized";
import type { EvidenceRef } from "@/domain/review";
import { getStageDefinition } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { formatDateTime } from "@/lib/format";
import { db } from "@/server/db";
import { getReviewDetail } from "@/server/services/reviews";
import { getStageGate } from "@/server/services/stages";

export default async function ReviewPage({ params }: { params: Promise<{ projectId: string; reviewId: string }> }) {
  const { projectId, reviewId } = await params;
  const review = await getReviewDetail(reviewId);
  if (!review || review.projectId !== projectId || !review.stored) notFound();
  const t = await getTranslations("review");
  const te = await getTranslations("enums");
  const locale = await getAppLocale();
  const s = review.stored;
  const c = review.comparison;
  const def = getStageDefinition(review.stage.stageKey);
  const base = `/projects/${projectId}`;
  const [otherReviews, latest, gate, mentorJob] = await Promise.all([
    db.review.findMany({ where: { stageId: review.stageId }, orderBy: { createdAt: "desc" }, include: { submission: { select: { versionNumber: true } } } }),
    db.review.findFirst({ where: { stageId: review.stageId }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    getStageGate(review.stageId),
    db.aiJob.findFirst({ where: { projectId, type: "follow_up", status: { in: ["queued", "running"] } } }),
  ]);
  const isLatest = latest?.id === review.id;
  const nextStage = await db.stage.findFirst({ where: { projectId, orderIndex: review.stage.orderIndex + 1 }, select: { id: true } });
  const manifest = new Map(s.evidenceManifest.map((m) => [m.ref, m]));
  const criterionName = (id: string) => {
    const cr = s.criteria.find((x) => x.id === id);
    return cr ? lt(cr.name, locale) : id;
  };
  const Evidence = ({ refs }: { refs: EvidenceRef[] }) =>
    refs.length ? (
      <ul className="mt-1.5 flex flex-col gap-1">
        {refs.map((r, i) => (
          <li key={i} className="text-xs text-subtle">
            <span className="ltr-isolate rounded bg-surface-muted px-1 font-mono">{r.ref}</span> {manifest.get(r.ref)?.label}
            {r.locator ? <span> · {r.locator}</span> : null}
            {r.quote ? (
              <q className="ms-1 italic" dir="auto">
                {r.quote}
              </q>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null;
  const issuesBySeverity = SEVERITIES.map((sev) => ({ sev, items: s.issues.filter((i) => i.severity === sev) })).filter((g) => g.items.length);
  const limitationText = (l: string) => {
    const [kind, ref, reason] = l.split(":");
    if (kind === "unavailable") return t("lim.unavailable", { ref: ref ?? "", reason: t(`lim.reason.${reason ?? "unknown"}`) });
    if (kind === "truncated") return t("lim.truncated", { ref: ref ?? "" });
    if (kind === "text_only") return t("lim.textOnly", { ref: ref ?? "" });
    if (kind === "removed_invalid_references") return t("lim.removedRefs", { count: Number(ref ?? 0) });
    return l;
  };
  const Delta = ({ d }: { d: number | null }) =>
    d === null ? <span className="text-subtle">—</span> : d > 0 ? <span className="ltr-isolate inline-flex items-center text-success"><ArrowUp className="size-3" aria-hidden />{d}</span> : d < 0 ? <span className="ltr-isolate inline-flex items-center text-danger"><ArrowDown className="size-3" aria-hidden />{Math.abs(d)}</span> : <span className="inline-flex items-center text-subtle"><Minus className="size-3" aria-hidden />0</span>;

  return (
    <PageContainer wide>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href={`${base}/stages/${review.stageId}`}>
          <ArrowLeft className="rtl:rotate-180" aria-hidden />
          {t("backToStage")}
        </Link>
      </Button>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            {t("eyebrow", { n: review.stage.orderIndex, version: review.submission.versionNumber ?? 0 })}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">{lt(def.title, locale)}</h2>
          <p className="mt-1 text-xs text-subtle">
            {formatDateTime(review.createdAt, locale)} · <span className="ltr-isolate">{review.model}</span> · {t("promptVersion")} <span className="ltr-isolate">{review.promptVersion}</span> · {t("rubricVersion")} <span className="ltr-isolate">{review.rubricVersion}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isLatest ? <Badge variant="neutral">{t("historical")}</Badge> : null}
          <Button asChild variant="outline">
            <Link href={`${base}/stages/${review.stageId}/submit?from=${review.submissionId}`}>
              <PenSquare aria-hidden />
              {t("resubmit")}
            </Link>
          </Button>
          {isLatest && (gate.eligible || review.stage.status === "completed") && nextStage ? (
            <Button asChild>
              <Link href={`${base}/stages/${review.stageId}`}>
                {gate.eligible ? t("completeAndContinue") : t("continueNext")}
                <ArrowRight className="rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {review.isMock ? (
        <Alert tone="warning" className="mb-4" title={t("mockTitle")}>
          {t("mockBody")}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-5 sm:flex-row">
              <ScoreRing score={review.overallScore} size={96} label={t("scoreLabel", { score: review.overallScore })} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DecisionBadge decision={review.decision} />
                  {review.isMock ? <MockBadge /> : null}
                  <Badge variant="outline">{t("threshold", { n: s.threshold })}</Badge>
                  <Badge variant="outline">{t("confidence", { n: s.confidence })}</Badge>
                </div>
                <p className="text-sm" dir="auto">
                  {s.summary}
                </p>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{t("whyDecision")}</h3>
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {s.decisionReasons.map((r, i) => (
                      <li key={i}>
                        •{" "}
                        {t(`reason.${r.code}`, {
                          criterion: r.criterionId ? criterionName(r.criterionId) : "",
                          deliverable: r.deliverableId ? lt(s.deliverables.find((d) => d.id === r.deliverableId)?.title ?? r.deliverableId, locale) : "",
                          detail: r.detail ?? "",
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-xs text-subtle">{t("confidenceNote")}</p>
              </div>
            </CardContent>
          </Card>

          {c ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("comparison")}</CardTitle>
                <p className="text-sm text-muted">
                  {t("comparisonSummary", { prev: c.previousScore, curr: c.currentScore })} <Delta d={c.scoreDelta} />
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{t("criteriaChange")}</h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {c.criteria.map((cr) => (
                      <li key={cr.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">{lt(cr.name, locale)}</span>
                        <span className="ltr-isolate flex shrink-0 items-center gap-2 tabular-nums">
                          <span className="text-subtle">{cr.previous ?? "—"}</span>→<span>{cr.current ?? "—"}</span>
                          <Delta d={cr.delta} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-3 text-sm">
                  {(
                    [
                      ["resolved", c.resolved, "success"],
                      ["partiallyResolved", c.partiallyResolved, "warning"],
                      ["unresolved", c.unresolved, "danger"],
                      ["notAssessed", c.notAssessed, "neutral"],
                    ] as const
                  ).map(([key, items, variant]) =>
                    items.length ? (
                      <div key={key}>
                        <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                          {t(`cmp.${key}`)} <Badge variant={variant}>{items.length}</Badge>
                        </h3>
                        <ul className="list-disc ps-5">
                          {items.map((i) => (
                            <li key={i.taskId} dir="auto">
                              {i.title}
                              {"note" in i && i.note ? <span className="block text-xs text-subtle">{i.note}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                      {t("cmp.newIssues")} <Badge>{c.newIssues.length}</Badge>
                    </h3>
                    <ul className="list-disc ps-5">
                      {c.newIssues.map((i) => (
                        <li key={i.id} dir="auto">
                          {i.title} <span className="text-xs text-subtle">({te(`severity.${i.severity}`)})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link href={`${base}/reviews/${c.previousReviewId}`} className="text-primary hover:underline">
                    {t("viewPrevious")}
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t("criteria")}</CardTitle>
              <p className="text-sm text-muted">{t("criteriaHint")}</p>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col divide-y divide-border">
                {s.criteria.map((cr) => (
                  <li key={cr.id} className="py-3 first:pt-0 last:pb-0" data-testid="criterion">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 text-sm font-medium">
                        {lt(cr.name, locale)}
                        {cr.mandatory ? <span className="ms-1 text-xs text-danger">*</span> : null}
                      </p>
                      <Badge variant="outline">{t("weight", { n: cr.weight })}</Badge>
                      <Badge variant={cr.status === "met" ? "success" : cr.status === "partial" ? "warning" : cr.status === "not_evaluable" ? "info" : "danger"}>{te(`criterionStatus.${cr.status}`)}</Badge>
                      {cr.severity ? <SeverityBadge severity={cr.severity} /> : null}
                      <span className="ltr-isolate w-12 text-end text-sm font-semibold tabular-nums">{cr.score === null ? "n/a" : cr.score}</span>
                    </div>
                    {cr.score !== null ? <Progress className="mt-2 h-1.5" value={cr.score} label={t("criterionScore", { name: lt(cr.name, locale), score: cr.score })} tone={cr.score >= 80 ? "success" : cr.score >= 60 ? "warning" : "primary"} /> : null}
                    {cr.feedback ? (
                      <p className="mt-2 text-sm text-muted" dir="auto">
                        {cr.feedback}
                      </p>
                    ) : null}
                    {cr.adjustments.length ? (
                      <p className="mt-1 text-xs text-info">{cr.adjustments.map((a) => t(`adj.${a.startsWith("capped_for_") ? "capped" : a}`, { status: te(`criterionStatus.${a.replace("capped_for_", "")}`) })).join(" · ")}</p>
                    ) : null}
                    <Evidence refs={cr.evidence} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("issues")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {issuesBySeverity.length === 0 ? <p className="text-sm text-muted">{t("noIssues")}</p> : null}
              {issuesBySeverity.map((g) => (
                <div key={g.sev}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <SeverityBadge severity={g.sev} /> <span className="ltr-isolate text-subtle">{g.items.length}</span>
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {g.items.map((i) => (
                      <li key={i.id} className="rounded-md border border-border p-3 text-sm" dir="auto">
                        <p className="font-medium">{i.title}</p>
                        <dl className="mt-1.5 grid gap-1.5">
                          <div>
                            <dt className="inline font-medium">{t("observed")}: </dt>
                            <dd className="inline text-muted">{i.observation}</dd>
                          </div>
                          <div>
                            <dt className="inline font-medium">{t("whyMatters")}: </dt>
                            <dd className="inline text-muted">{i.impact}</dd>
                          </div>
                          <div>
                            <dt className="inline font-medium">{t("howToImprove")}: </dt>
                            <dd className="inline text-muted">{i.recommendation}</dd>
                          </div>
                        </dl>
                        <p className="mt-1 text-xs text-subtle">
                          {t("criterion")}: {criterionName(i.criterionId)}
                        </p>
                        <Evidence refs={i.evidence} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("strengths")}</CardTitle>
              </CardHeader>
              <CardContent>
                {s.strengths.length ? (
                  <ul className="flex flex-col gap-2 text-sm" dir="auto">
                    {s.strengths.map((st, i) => (
                      <li key={i}>
                        {st.text}
                        <Evidence refs={st.evidence} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("none")}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("deliverables")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {s.deliverables.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0">
                        {lt(d.title, locale)}
                        {!d.mandatory ? <span className="ms-1 text-xs text-subtle">({t("optional")})</span> : null}
                        {d.note ? (
                          <span className="block text-xs text-subtle" dir="auto">
                            {d.note}
                          </span>
                        ) : null}
                      </span>
                      <Badge variant={d.status === "provided" ? "success" : d.status === "partial" ? "warning" : d.status === "missing" ? "danger" : "info"}>{te(`deliverableStatus.${d.status}`)}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("assumptions")}</CardTitle>
              </CardHeader>
              <CardContent>
                {s.assumptionsToValidate.length ? (
                  <ul className="list-disc ps-5 text-sm" dir="auto">
                    {s.assumptionsToValidate.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("none")}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("questions")}</CardTitle>
              </CardHeader>
              <CardContent>
                {s.questionsForDesigner.length ? (
                  <ul className="list-disc ps-5 text-sm" dir="auto">
                    {s.questionsForDesigner.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{t("none")}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("limitations")}</CardTitle>
              <p className="text-sm text-muted">{t("limitationsHint")}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {s.limitations.length ? (
                <ul className="list-disc ps-5 text-sm" dir="auto">
                  {s.limitations.map((l, i) => (
                    <li key={i}>{limitationText(l)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t("noLimitations")}</p>
              )}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{t("evidenceManifest")}</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {s.evidenceManifest.map((m) => (
                    <li key={m.ref} className="flex flex-wrap items-center gap-2">
                      <span className="ltr-isolate rounded bg-surface-muted px-1 font-mono text-xs">{m.ref}</span>
                      <span className="min-w-0 break-all" dir="auto">
                        {m.label}
                      </span>
                      <Badge variant={m.available ? "success" : "warning"}>{m.available ? t("seen") : t("notSeen")}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("revisionTasks")}</CardTitle>
              <p className="text-xs text-subtle">{t("revisionTasksHint")}</p>
            </CardHeader>
            <CardContent>
              <RevisionTaskList
                tasks={review.revisionTasks.map((rt) => ({
                  id: rt.id,
                  title: rt.title,
                  description: rt.description,
                  reason: rt.reason,
                  suggestedAction: rt.suggestedAction,
                  severity: rt.severity,
                  criterionName: rt.criterionId ? criterionName(rt.criterionId) : null,
                  theme: rt.theme,
                  status: rt.status,
                  resolutionNote: rt.resolutionNote,
                }))}
              />
            </CardContent>
          </Card>
          {s.nextSteps.length ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("nextSteps")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc ps-5 text-sm" dir="auto">
                  {s.nextSteps.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardContent className="pt-5">
              <MentorChat
                projectId={projectId}
                reviewId={review.id}
                title={t("followUp")}
                initialMessages={review.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, isMock: m.isMock }))}
                pendingJobId={mentorJob?.id ?? null}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("allReviews")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1.5 text-sm">
                {otherReviews.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`${base}/reviews/${r.id}`}
                      aria-current={r.id === review.id ? "page" : undefined}
                      className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-muted aria-[current=page]:bg-primary-soft"
                    >
                      <span className="ltr-isolate w-8">v{r.submission.versionNumber}</span>
                      <span className="ltr-isolate w-8 font-semibold tabular-nums">{r.overallScore}</span>
                      <DecisionBadge decision={r.decision} />
                      <span className="ms-auto text-xs text-subtle">{formatDateTime(r.createdAt, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
