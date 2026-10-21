"use client";

import { useEffect, useRef, useState } from "react";

export interface JobState {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  errorCode: string | null;
  errorMessage: string | null;
  result: unknown;
  createdAt: string;
  startedAt: string | null;
}

/** Polls a persisted AI job until it finishes. Survives page reloads because state lives on the server. */
export function useJob(jobId: string | null, opts: { onDone?: (job: JobState) => void; intervalMs?: number } = {}) {
  const [job, setJob] = useState<JobState | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const onDone = useRef(opts.onDone);
  onDone.current = opts.onDone;

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const body = (await res.json()) as { ok: boolean; data?: JobState };
        if (stopped) return;
        setNetworkError(false);
        if (body.ok && body.data) {
          setJob(body.data);
          if (["succeeded", "failed", "cancelled"].includes(body.data.status)) {
            onDone.current?.(body.data);
            return;
          }
        }
      } catch {
        if (!stopped) setNetworkError(true);
      }
      timer = setTimeout(tick, opts.intervalMs ?? 1500);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, opts.intervalMs]);

  const active = job ? job.status === "queued" || job.status === "running" : Boolean(jobId);
  return { job, active, networkError };
}
