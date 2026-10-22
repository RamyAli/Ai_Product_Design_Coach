"use client";

import { Archive, ArchiveRestore, Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { archiveProjectAction, deleteProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function ProjectActions({ projectId, title, archived, afterDelete = "/projects" }: { projectId: string; title: string; archived: boolean; afterDelete?: string }) {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | undefined>();

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button asChild variant="ghost" size="sm">
        <a href={`/api/projects/${projectId}/export`} download>
          <Download aria-hidden />
          {t("export")}
        </a>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await archiveProjectAction(projectId, !archived);
            if (res.ok) router.refresh();
            else toast.push(res.error.message, "error");
          })
        }
      >
        {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {archived ? t("unarchive") : t("archive")}
      </Button>
      <Dialog onOpenChange={() => { setConfirm(""); setError(undefined); }}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-danger">
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        </DialogTrigger>
        <DialogContent closeLabel={tc("close")}>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{t("deleteBody")}</DialogDescription>
          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await deleteProjectAction(projectId, confirm);
                if (res.ok) {
                  toast.push(t("deleted"), "success");
                  router.push(afterDelete);
                  router.refresh();
                } else setError(res.error.message);
              });
            }}
          >
            <Field id={`confirm-${projectId}`} label={t("typeTitle", { title })} error={error}>
              {(p) => <Input {...p} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}
            </Field>
            <DialogFooter>
              <Button type="submit" variant="danger" disabled={pending || confirm.trim() !== title.trim()}>
                {t("deleteForever")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
