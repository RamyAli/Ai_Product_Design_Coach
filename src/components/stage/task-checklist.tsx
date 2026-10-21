"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toggleTaskAction } from "@/app/actions/stages";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export interface ChecklistTask {
  id: string;
  title: string;
  description: string;
  isMandatory: boolean;
  status: string;
  taskType: string;
}

export function TaskChecklist({ tasks, disabled }: { tasks: ChecklistTask[]; disabled?: boolean }) {
  const t = useTranslations("workspace");
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(tasks);
  const inFlight = useRef(0);

  // Adopt server state whenever it changes and no local save is pending.
  useEffect(() => {
    if (inFlight.current === 0) setItems(tasks);
  }, [tasks]);

  const toggle = async (id: string, done: boolean) => {
    setItems((prev) => prev.map((task) => (task.id === id ? { ...task, status: done ? "done" : "todo" } : task)));
    inFlight.current += 1;
    const res = await toggleTaskAction(id, done);
    inFlight.current -= 1;
    if (!res.ok) {
      toast.push(res.error.message, "error");
      setItems((prev) => prev.map((task) => (task.id === id ? { ...task, status: done ? "todo" : "done" } : task)));
    }
    // Refresh once after the last pending save so gates and progress reflect the checklist.
    if (inFlight.current === 0) router.refresh();
  };

  const done = items.filter((x) => x.status === "done").length;
  return (
    <div>
      <p className="mb-2 text-xs text-subtle" aria-live="polite">
        {t("tasksDone", { done, total: items.length })}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((task) => (
          <li key={task.id}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md p-1.5 text-sm hover:bg-surface-muted">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                checked={task.status === "done"}
                disabled={disabled}
                onChange={(e) => void toggle(task.id, e.target.checked)}
              />
              <span className="min-w-0">
                <span className={task.status === "done" ? "text-muted line-through" : ""}>{task.title}</span>
                <span className="ms-1.5 inline-flex gap-1 align-middle">
                  {!task.isMandatory ? <Badge>{t("optional")}</Badge> : null}
                  {task.taskType === "tailored" ? <Badge variant="info">{t("tailored")}</Badge> : null}
                </span>
                {task.description ? <span className="mt-0.5 block text-xs text-subtle">{task.description}</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
