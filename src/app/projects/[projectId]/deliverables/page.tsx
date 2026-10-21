import { FileText, Frame, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { StageStatusBadge } from "@/components/common/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StoredReview } from "@/domain/review";
import { lt } from "@/domain/localized";
import { getStageDefinition } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { db, parseJson } from "@/server/db";
import { rubricForStage } from "@/server/services/rubric";

export default async function DeliverablesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const stages = await db.stage.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
    include: {
      reviews: { orderBy: { createdAt: "desc" }, take: 1, select: { reviewJson: true, id: true } },
      submissions: { where: { status: "submitted" }, orderBy: { versionNumber: "desc" }, take: 1, include: { assets: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (stages.length === 0) notFound();
  const t = await getTranslations("deliverablesPage");
  const te = await getTranslations("enums");
  const locale = await getAppLocale();
  return (
    <PageContainer>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>
      <div className="flex flex-col gap-4">
        {stages.map((s) => {
          const def = getStageDefinition(s.stageKey);
          const rubric = rubricForStage(s);
          const stored = s.reviews[0] ? parseJson<StoredReview | null>(s.reviews[0].reviewJson, null) : null;
          const statusById = new Map(stored?.deliverables.map((d) => [d.id, d.status]) ?? []);
          const latest = s.submissions[0];
          return (
            <Card key={s.id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle as="h3">
                  <Link href={`/projects/${projectId}/stages/${s.id}`} className="hover:underline">
                    {s.orderIndex}. {lt(def.title, locale)}
                  </Link>
                </CardTitle>
                <StageStatusBadge status={s.status} />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <ul className="flex flex-col gap-2 text-sm">
                  {rubric.deliverables.map((d) => {
                    const st = statusById.get(d.id);
                    return (
                      <li key={d.id} className="flex items-start justify-between gap-2">
                        <span>
                          {lt(d.title, locale)}
                          {!d.mandatory ? <span className="ms-1 text-xs text-subtle">({t("optional")})</span> : null}
                        </span>
                        <Badge variant={!st ? "neutral" : st === "provided" ? "success" : st === "partial" ? "warning" : st === "missing" ? "danger" : "info"}>
                          {st ? te(`deliverableStatus.${st}`) : t("notReviewed")}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{latest ? t("latestVersion", { n: latest.versionNumber ?? 0 }) : t("noSubmission")}</h4>
                  {latest ? (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {latest.textContent.trim() ? (
                        <li className="flex items-center gap-2">
                          <FileText className="size-4 text-subtle" aria-hidden /> {t("writtenWork", { words: latest.textContent.trim().split(/\s+/).length })}
                        </li>
                      ) : null}
                      {latest.assets.map((a) => (
                        <li key={a.id} className="flex items-center gap-2">
                          {a.kind === "image" ? <ImageIcon className="size-4 text-subtle" aria-hidden /> : a.kind === "pdf" ? <FileText className="size-4 text-subtle" aria-hidden /> : <Frame className="size-4 text-subtle" aria-hidden />}
                          {a.kind === "figma" ? (
                            <a href={a.sourceUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                              {a.originalFilename}
                            </a>
                          ) : (
                            <a href={`/api/assets/${a.id}`} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline" dir="auto">
                              {a.originalFilename}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
