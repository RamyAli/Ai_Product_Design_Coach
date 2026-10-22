import type { StageStatus } from "@/domain/enums";

export type NextActionKind =
  | "start_project"
  | "start_stage"
  | "continue_stage"
  | "await_review"
  | "address_revisions"
  | "complete_stage"
  | "revalidate_stage"
  | "write_case_study";

export interface NextAction {
  kind: NextActionKind;
  href: string;
  stageTitle?: string;
  stageNumber?: number;
}

/** Derives the single most useful next step from persisted project state. */
export function nextActionFor(project: { id: string; status: string }, stages: { id: string; title: string; status: string; orderIndex: number; hasDraftOrSubmission: boolean }[]): NextAction {
  const base = `/projects/${project.id}`;
  if (project.status === "draft") return { kind: "start_project", href: base };
  const revalidate = stages.find((s) => s.status === "needs_revalidation");
  if (revalidate) return { kind: "revalidate_stage", href: `${base}/stages/${revalidate.id}`, stageTitle: revalidate.title, stageNumber: revalidate.orderIndex };
  const current = stages.find((s) => s.status !== "completed");
  if (!current) return { kind: "write_case_study", href: `${base}/case-study` };
  const common = { href: `${base}/stages/${current.id}`, stageTitle: current.title, stageNumber: current.orderIndex };
  const status = current.status as StageStatus;
  if (status === "in_review") return { kind: "await_review", ...common };
  if (status === "needs_revision") return { kind: "address_revisions", ...common };
  if (status === "ready_to_complete") return { kind: "complete_stage", ...common };
  return { kind: current.hasDraftOrSubmission ? "continue_stage" : "start_stage", ...common };
}
