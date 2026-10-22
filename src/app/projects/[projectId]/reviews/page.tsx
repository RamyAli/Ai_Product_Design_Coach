import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { DecisionBadge, MockBadge } from "@/components/common/status";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { stageTitle } from "@/domain/stages/definitions";
import { getAppLocale } from "@/i18n/request";
import { formatDateTime } from "@/lib/format";
import { listProjectReviews } from "@/server/services/reviews";

export default async function ReviewsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const t = await getTranslations("reviewsList");
  const locale = await getAppLocale();
  const reviews = await listProjectReviews(projectId);
  return (
    <PageContainer>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={<ClipboardCheck />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {reviews.map((r) => (
              <li key={r.id}>
                <Link href={`/projects/${projectId}/reviews/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-surface-muted">
                  <span className="ltr-isolate w-10 text-lg font-semibold tabular-nums">{r.overallScore}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {r.stage.orderIndex}. {stageTitle(r.stage.stageKey, locale)} · v{r.submission.versionNumber}
                    </p>
                    <p className="line-clamp-1 text-xs text-muted" dir="auto">
                      {r.summary}
                    </p>
                  </div>
                  <DecisionBadge decision={r.decision} />
                  {r.isMock ? <MockBadge /> : null}
                  <span className="text-xs text-subtle">{t("tasks", { count: r._count.revisionTasks })}</span>
                  <span className="text-xs text-subtle">{formatDateTime(r.createdAt, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageContainer>
  );
}
