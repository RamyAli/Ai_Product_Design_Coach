import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { StartFromVersion } from "@/components/submission/start-from-version";
import { SubmissionEditor } from "@/components/submission/submission-editor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { canWorkOnStage } from "@/domain/gates";
import type { Locale, StageStatus } from "@/domain/enums";
import { lt } from "@/domain/localized";
import { getStageDefinition } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { LIMITS } from "@/server/config";
import { db } from "@/server/db";
import { toAssetDto } from "@/server/dto";
import { rubricForStage } from "@/server/services/rubric";
import { getSettings } from "@/server/settings";

export default async function SubmitPage({ params, searchParams }: { params: Promise<{ projectId: string; stageId: string }>; searchParams: Promise<{ from?: string }> }) {
  const { projectId, stageId } = await params;
  const { from } = await searchParams;
  const stage = await db.stage.findFirst({ where: { id: stageId, projectId }, include: { project: true } });
  if (!stage) notFound();
  const t = await getTranslations("submission");
  const locale = await getAppLocale();
  const def = getStageDefinition(stage.stageKey);
  const stageHref = `/projects/${projectId}/stages/${stageId}`;
  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-3">
      <Link href={stageHref}>
        <ArrowLeft className="rtl:rotate-180" aria-hidden />
        {t("backToStage")}
      </Link>
    </Button>
  );
  if (!canWorkOnStage(stage.status as StageStatus, stage.project.practiceMode)) {
    return (
      <PageContainer>
        {back}
        <EmptyState icon={<Lock />} title={t("lockedTitle")} description={t("lockedBody")} />
      </PageContainer>
    );
  }
  const [draft, settings, submitted] = await Promise.all([
    db.submission.findFirst({ where: { stageId, status: "draft" }, include: { assets: { orderBy: { createdAt: "asc" } } } }),
    getSettings(),
    db.submission.findMany({ where: { stageId, status: "submitted" }, orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true } }),
  ]);
  const versions = submitted.length;
  const source = submitted.find((s) => s.id === from) ?? submitted[0];
  const rubric = rubricForStage(stage);
  const projectLang = stage.project.preferredLanguage as Locale;
  return (
    <PageContainer wide>
      {back}
      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t("eyebrow", { n: stage.orderIndex, version: versions + 1 })}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{lt(def.title, locale)}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{t("intro")}</p>
      </div>
      {!draft && source ? <StartFromVersion stageId={stage.id} submissionId={source.id} versionNumber={source.versionNumber ?? 0} /> : null}
      <SubmissionEditor
        key={draft?.id ?? "new"}
        stageId={stage.id}
        stageHref={stageHref}
        stageCompleted={stage.status === "completed"}
        uiLocale={locale}
        maxUploadMb={settings.maxUploadMb}
        maxFiles={LIMITS.maxFilesPerSubmission}
        draft={draft ? { id: draft.id, textContent: draft.textContent, notes: draft.notes, updatedAt: draft.updatedAt.toISOString(), assets: draft.assets.map(toAssetDto) } : null}
        deliverables={rubric.deliverables.map((d) => ({ id: d.id, title: lt(d.title, locale), mandatory: d.mandatory, evidence: d.evidence }))}
        templates={def.templates.map((tpl) => ({ id: tpl.id, title: lt(tpl.title, locale), body: lt(tpl.body, projectLang) }))}
      />
    </PageContainer>
  );
}
