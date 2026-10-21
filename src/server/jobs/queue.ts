import type { AiJob } from "@prisma/client";
import type { JobType } from "@/domain/enums";
import { AIError } from "../ai/errors";
import type { AIUsage } from "../ai/types";
import { LIMITS } from "../config";
import { db } from "../db";
import { AppError } from "../errors";
import { IngestionError } from "../ingestion/errors";

export interface JobOutcome {
  result: unknown;
  usage?: AIUsage | null;
  provider?: string;
  model?: string;
}

export type JobHandler = (job: AiJob, signal: AbortSignal) => Promise<JobOutcome>;

interface QueueState {
  pending: string[];
  running: Map<string, AbortController>;
  inflight: Set<Promise<void>>;
}

const g = globalThis as unknown as { __coachJobQueue?: QueueState };
function state(): QueueState {
  if (!g.__coachJobQueue) g.__coachJobQueue = { pending: [], running: new Map(), inflight: new Set() };
  return g.__coachJobQueue;
}

export async function createJob(params: {
  type: JobType;
  input: unknown;
  projectId?: string | null;
  stageId?: string | null;
  submissionId?: string | null;
}): Promise<AiJob> {
  const job = await db.aiJob.create({
    data: {
      type: params.type,
      status: "queued",
      inputJson: JSON.stringify(params.input),
      projectId: params.projectId ?? null,
      stageId: params.stageId ?? null,
      submissionId: params.submissionId ?? null,
    },
  });
  enqueue(job.id);
  return job;
}

export function enqueue(jobId: string): void {
  const s = state();
  if (s.pending.includes(jobId) || s.running.has(jobId)) return;
  s.pending.push(jobId);
  pump();
}

function pump(): void {
  const s = state();
  while (s.running.size < LIMITS.maxConcurrentAiJobs && s.pending.length > 0) {
    const id = s.pending.shift()!;
    const controller = new AbortController();
    s.running.set(id, controller);
    const p = runJob(id, controller.signal)
      .catch((err) => console.error("[jobs] unexpected runner failure", err))
      .finally(() => {
        s.running.delete(id);
        s.inflight.delete(p);
        pump();
      });
    s.inflight.add(p);
  }
}

function describeError(err: unknown): { code: string; message: string; detail?: string } {
  if (err instanceof AIError) return { code: `ai_${err.code}`, message: err.message, detail: err.detail };
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof IngestionError) return { code: err.code, message: err.message };
  return { code: "internal", message: "Something went wrong while processing this request. Your work is saved; please try again.", detail: err instanceof Error ? err.stack : String(err) };
}

async function runJob(id: string, signal: AbortSignal): Promise<void> {
  const job = await db.aiJob.findUnique({ where: { id } });
  if (!job || job.status !== "queued") return;
  await db.aiJob.update({ where: { id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } });
  const { JOB_HANDLERS } = await import("./handlers");
  const handler = JOB_HANDLERS[job.type as JobType];
  try {
    if (!handler) throw new AppError("internal", `No handler for job type ${job.type}`);
    const outcome = await handler(job, signal);
    const current = await db.aiJob.findUnique({ where: { id }, select: { status: true } });
    if (current?.status === "cancelled") return;
    await db.aiJob.update({
      where: { id },
      data: {
        status: "succeeded",
        resultJson: JSON.stringify(outcome.result ?? null),
        usageJson: outcome.usage ? JSON.stringify(outcome.usage) : null,
        provider: outcome.provider ?? null,
        model: outcome.model ?? null,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    const info = describeError(err);
    if (info.detail) console.error(`[jobs] ${job.type} ${id} failed (${info.code}):`, info.detail);
    const cancelled = signal.aborted || (err instanceof AIError && err.code === "cancelled");
    await db.aiJob.update({
      where: { id },
      data: {
        status: cancelled ? "cancelled" : "failed",
        errorCode: cancelled ? "cancelled" : info.code,
        errorMessage: cancelled ? "Cancelled." : info.message,
        finishedAt: new Date(),
      },
    });
  }
}

/**
 * Returns a job, reconciling jobs orphaned by an app restart: a "running" job with no live
 * worker becomes failed (retryable) and a "queued" job not in memory is re-queued.
 */
export async function getJob(id: string): Promise<AiJob | null> {
  const job = await db.aiJob.findUnique({ where: { id } });
  if (!job) return null;
  const s = state();
  if (job.status === "running" && !s.running.has(id)) {
    return db.aiJob.update({
      where: { id },
      data: { status: "failed", errorCode: "interrupted", errorMessage: "This request was interrupted (the app restarted). Please try again.", finishedAt: new Date() },
    });
  }
  if (job.status === "queued" && !s.pending.includes(id) && !s.running.has(id)) enqueue(id);
  return job;
}

export async function cancelJob(id: string): Promise<AiJob | null> {
  const job = await db.aiJob.findUnique({ where: { id } });
  if (!job || (job.status !== "queued" && job.status !== "running")) return job;
  const s = state();
  s.pending = s.pending.filter((p) => p !== id);
  s.running.get(id)?.abort();
  return db.aiJob.update({ where: { id }, data: { status: "cancelled", errorCode: "cancelled", errorMessage: "Cancelled.", finishedAt: new Date() } });
}

/** Waits until every queued and running job in this process has finished (used by tests). */
export async function drainJobs(): Promise<void> {
  const s = state();
  while (s.inflight.size > 0 || s.pending.length > 0) {
    await Promise.allSettled([...s.inflight]);
    if (s.inflight.size === 0 && s.pending.length > 0) pump();
  }
}

export function isJobActive(status: string): boolean {
  return status === "queued" || status === "running";
}
