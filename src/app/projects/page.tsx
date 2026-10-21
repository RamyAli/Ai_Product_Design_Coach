import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/common/page";
import { LoadSampleButton } from "@/components/common/sample-button";
import { StageStatusBadge } from "@/components/common/status";
import { ProjectActions } from "@/components/projects/project-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { getAppLocale } from "@/i18n/request";
import { stageTitle } from "@/domain/stages/definitions";
import { formatDate } from "@/lib/format";
import { db } from "@/server/db";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("projects") };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const t = await getTranslations("projects");
  const te = await getTranslations("enums");
  const locale = await getAppLocale();
  const showArchived = (await searchParams).archived === "1";
  const projects = await db.project.findMany({
    where: showArchived ? { status: "archived" } : { status: { not: "archived" } },
    orderBy: [{ updatedAt: "desc" }],
    include: { stages: { select: { id: true, status: true, orderIndex: true, title: true, stageKey: true }, orderBy: { orderIndex: "asc" } } },
  });

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={showArchived ? "/projects" : "/projects?archived=1"}>{showArchived ? t("showActive") : t("showArchived")}</Link>
            </Button>
            <Button asChild>
              <Link href="/projects/new">
                <Plus aria-hidden />
                {t("new")}
              </Link>
            </Button>
          </>
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban />}
          title={showArchived ? t("noArchived") : t("emptyTitle")}
          description={showArchived ? undefined : t("emptyBody")}
          action={
            showArchived ? undefined : (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/projects/new">{t("new")}</Link>
                </Button>
                <LoadSampleButton />
              </div>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const done = p.stages.filter((s) => s.status === "completed").length;
            const current = p.stages.find((s) => s.status !== "completed");
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={p.status === "completed" ? "success" : p.status === "draft" ? "neutral" : "primary"}>{te(`projectStatus.${p.status}`)}</Badge>
                      {p.isSample ? <Badge variant="warning">{t("sample")}</Badge> : null}
                      {p.practiceMode ? <Badge variant="info">{t("practice")}</Badge> : null}
                      <span className="text-xs text-subtle">
                        {p.industry} · {te(`platform.${p.platform}`)} · {te(`difficulty.${p.difficulty}`)}
                      </span>
                    </div>
                    <h2 className="truncate text-base font-semibold">
                      <Link href={`/projects/${p.id}`} className="hover:underline">
                        {p.title}
                      </Link>
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex w-40 items-center gap-2">
                        <Progress value={(done / 8) * 100} label={t("stagesDone", { done, total: p.stages.length })} />
                        <span className="ltr-isolate text-xs tabular-nums text-muted">{done}/{p.stages.length}</span>
                      </div>
                      {current ? (
                        <span className="flex items-center gap-2 text-muted">
                          {stageTitle(current.stageKey, locale)} <StageStatusBadge status={current.status} />
                        </span>
                      ) : null}
                      <span className="text-xs text-subtle">{t("updated", { date: formatDate(p.updatedAt, locale) })}</span>
                    </div>
                  </div>
                  <ProjectActions projectId={p.id} title={p.title} archived={p.status === "archived"} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
