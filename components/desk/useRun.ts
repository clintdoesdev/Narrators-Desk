"use client";

import { useCallback, useRef, useState } from "react";
import { putTake, takeKey, type TakeRecord } from "@/lib/cache";
import { Runner, TtsError, requestTake, type Job, type RunnerState } from "@/lib/runner";
import { useWakeLock } from "./useWakeLock";

export type JobView = {
  job: Job;
  status: "queued" | "generating" | "failed";
  error?: string;
  retry?: { attempt: number; delayMs: number; message: string };
};

export type RunProgress = { total: number; done: number; failed: number };

export type RunState = {
  state: RunnerState;
  jobs: Record<string, JobView>;
  progress: RunProgress;
  notice: { tone: "error" | "info"; message: string } | null;
  failed: Job[];
  start: (jobs: Job[]) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  dismissNotice: () => void;
};

export function useRun(video: string | null, onTake: (rec: TakeRecord) => void, onFinish?: () => void): RunState {
  const runner = useRef<Runner | null>(null);
  const [state, setState] = useState<RunnerState>("idle");
  const [jobs, setJobs] = useState<Record<string, JobView>>({});
  const [progress, setProgress] = useState<RunProgress>({ total: 0, done: 0, failed: 0 });
  const [notice, setNotice] = useState<RunState["notice"]>(null);

  const active = state === "running" || state === "paused";
  useWakeLock(active);

  const start = useCallback(
    (list: Job[]) => {
      if (!video || list.length === 0 || runner.current?.state === "running" || runner.current?.state === "paused") return;
      const runVideo = video;
      setNotice(null);
      setProgress({ total: list.length, done: 0, failed: 0 });
      // Retried jobs replace their old failed entries; other failures stay listed.
      setJobs((prev) => {
        const next = { ...prev };
        for (const j of list) delete next[j.key];
        return next;
      });

      const r = new Runner(
        list,
        async (job, { signal, onRetry }) => {
          const blob = await requestTake({ text: job.text, model: job.model, seed: job.seed }, { signal, onRetry });
          const value = { blob, seed: job.seed, model: job.model, createdAt: Date.now(), textHash: job.textHash };
          await putTake(runVideo, job.chunkId, job.take, value);
          onTake({ ...value, chunkId: job.chunkId, take: job.take, key: takeKey(runVideo, job.chunkId, job.take) });
        },
        {
          onEvent: (e) => {
            if (e.type === "state") {
              setState(e.state);
              return;
            }
            const key = e.job.key;
            if (e.type === "cancelled") {
              setJobs((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
              return;
            }
            if (e.type === "retry") {
              setJobs((prev) => ({
                ...prev,
                [key]: {
                  job: e.job,
                  status: "generating",
                  retry: { attempt: e.attempt, delayMs: e.delayMs, message: e.error.display },
                },
              }));
              return;
            }
            if (e.status === "done") {
              setJobs((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
              setProgress((p) => ({ ...p, done: p.done + 1 }));
              return;
            }
            if (e.status === "failed") {
              const err = e.error;
              setJobs((prev) => ({ ...prev, [key]: { job: e.job, status: "failed", error: err?.display } }));
              setProgress((p) => ({ ...p, failed: p.failed + 1 }));
              if (err?.sessionExpired) {
                setNotice({ tone: "error", message: "Your session expired. Sign in again; finished takes are saved." });
              } else if (err?.fatal) {
                setNotice({ tone: "error", message: `Run stopped: ${err.display}` });
              }
              return;
            }
            const status = e.status; // "queued" | "generating"
            setJobs((prev) => ({ ...prev, [key]: { job: e.job, status } }));
          },
        },
      );
      runner.current = r;
      r.start()
        .catch((e: unknown) => {
          const msg = e instanceof TtsError ? e.display : "The run stopped unexpectedly.";
          setNotice({ tone: "error", message: msg });
        })
        .finally(() => {
          onFinish?.();
        });
    },
    [video, onTake, onFinish],
  );

  const failed = Object.values(jobs)
    .filter((j) => j.status === "failed")
    .map((j) => j.job);

  return {
    state,
    jobs,
    progress,
    notice,
    failed,
    start,
    pause: () => runner.current?.pause(),
    resume: () => runner.current?.resume(),
    cancel: () => runner.current?.cancel(),
    dismissNotice: () => setNotice(null),
  };
}
