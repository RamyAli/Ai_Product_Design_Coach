import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivateProjectButton } from "@/components/projects/project-header-actions";
import { ProjectNav } from "@/components/projects/project-nav";
import { Badge } from "@/components/ui/badge";
import { detectTextDirection } from "@/domain/localized";
import { db } from "@/server/db";
import { touchProject } from "@/server/services/projects";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, status: true, isSample: true, practiceMode: true, preferredLanguage: true, generationSource: true },
  });
  if (!project) notFound();
  await touchProject(project.id);
  const t = await getTranslations("project");
  const te = await getTranslations("enums");
  const dir = detectTextDirection(project.title);
  return (
    <div>
      <div className="border-b border-border">
        <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={project.status === "completed" ? "success" : project.status === "draft" ? "neutral" : "primary"}>{te(`projectStatus.${project.status}`)}</Badge>
            {project.isSample ? <Badge variant="warning">{t("sample")}</Badge> : null}
            {project.generationSource === "mock" && !project.isSample ? <Badge variant="warning">{t("mockBrief")}</Badge> : null}
            {project.practiceMode ? <Badge variant="info">{t("practiceBadge")}</Badge> : null}
            <Badge variant="outline">{te(`language.${project.preferredLanguage}`)}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold" dir={dir === "auto" ? undefined : dir}>
              {project.title}
            </h1>
            {project.status === "draft" ? <ActivateProjectButton projectId={project.id} /> : null}
          </div>
          <div className="mt-3">
            <ProjectNav projectId={project.id} />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
