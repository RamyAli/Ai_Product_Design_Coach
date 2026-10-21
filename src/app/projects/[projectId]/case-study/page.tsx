import { CheckCircle2, Circle, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CaseStudyEditor } from "@/components/case-study/case-study-editor";
import { PageContainer } from "@/components/common/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Progress } from "@/components/ui/misc";
import { db } from "@/server/db";
import { buildCaseStudyOutline, caseStudyAvailability, getCaseStudy } from "@/server/services/caseStudy";

export default async function CaseStudyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const t = await getTranslations("caseStudy");
  const availability = await caseStudyAvailability(projectId);
  const existing = await getCaseStudy(projectId);
  const job = await db.aiJob.findFirst({ where: { projectId, type: "case_study", status: { in: ["queued", "running"] } } });

  if (!availability.available && !existing) {
    return (
      <PageContainer>
        <h2 className="sr-only">{t("title")}</h2>
        <EmptyState
          icon={<Lock />}
          title={t("lockedTitle")}
          description={t("lockedBody", { required: availability.required, completed: availability.completed })}
          action={
            <div className="w-64">
              <Progress value={(availability.completed / availability.required) * 100} label={t("lockedProgress", { completed: availability.completed, required: availability.required })} />
            </div>
          }
        />
      </PageContainer>
    );
  }
  const outline = await buildCaseStudyOutline(projectId);
  return (
    <PageContainer wide>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="max-w-3xl text-sm text-muted">{t("subtitle")}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <CaseStudyEditor projectId={projectId} initial={existing?.contentMarkdown ?? null} source={existing?.source ?? null} pendingJobId={job?.id ?? null} />
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>{t("coverage")}</CardTitle>
              <p className="text-xs text-subtle">{t("coverageHint")}</p>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2 text-sm">
                {outline.sections.map((s, i) => (
                  <li key={s.id} className="flex items-start gap-2">
                    {s.supported ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />}
                    <span>
                      <span className="ltr-isolate">{i + 1}.</span> {s.title}
                      <span className="sr-only">{s.supported ? t("supported") : t("missing")}</span>
                      {!s.supported && s.missingReason ? <span className="block text-xs text-subtle">{s.missingReason}</span> : null}
                    </span>
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
