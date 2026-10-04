"use client";

import { AlertCircle, ChevronRight, Flame, Pause, Play, RotateCcw, Square, Trash2, X } from "lucide-react";
import type { RunState } from "./useRun";

export type ModeOption = { jobs: number; credits: number };

export type GenerateProps = {
  run: RunState;
  climax: ModeOption;
  all: ModeOption;
  blockedReason: string | null;
  staleCount: number;
  onClimax: () => void;
  onAll: () => void;
  onRetry: () => void;
  onClearStale: () => void;
  remaining: number | null;
};

export function ProgressBar({
  total,
  done,
  failed,
  dark,
}: {
  total: number;
  done: number;
  failed: number;
  dark?: boolean;
}) {
  const pctDone = total ? (done / total) * 100 : 0;
  const pctFailed = total ? (failed / total) * 100 : 0;
  return (
    <div
      className={`flex h-1 w-full overflow-hidden rounded-full ${dark ? "bg-on-dark-hairline" : "bg-hairline"}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done + failed}
      aria-label="Run progress"
    >
      <div
        className={`h-full transition-[width] duration-500 ease-out ${dark ? "bg-primary-on-dark" : "bg-primary"}`}
        style={{ width: `${pctDone}%` }}
      />
      <div
        className={`h-full transition-[width] duration-500 ease-out ${dark ? "bg-error-on-dark" : "bg-error"}`}
        style={{ width: `${pctFailed}%` }}
      />
    </div>
  );
}

export function progressText(run: RunState): string {
  const { total, done, failed } = run.progress;
  const parts = [`${done} of ${total} takes`];
  if (failed) parts.push(`${failed} failed`);
  if (run.state === "paused") parts.push("paused");
  if (run.state === "cancelled") parts.push("cancelled");
  return parts.join(" · ");
}

/** Lives on the dark tile: a centered headline, a tagline, and two pills. */
export function GeneratePanel(p: GenerateProps) {
  const { run } = p;
  const active = run.state === "running" || run.state === "paused";
  const disabled = active || Boolean(p.blockedReason);
  const showProgress = run.progress.total > 0;
  const nothingToDo = p.all.jobs === 0 && !p.blockedReason;
  const heavy = p.remaining != null && p.all.credits > p.remaining * 0.8 && p.all.jobs > 0;

  return (
    <div className="flex flex-col items-center text-center">
      {active ? (
        <>
          <p className="t-hero text-on-dark tabular">
            {run.progress.done}
            <span className="text-on-dark-muted"> / {run.progress.total}</span>
          </p>
          <p className="t-lead mt-3 text-on-dark-muted">
            {run.state === "paused" ? "Paused. In-flight takes are finishing." : "Generating takes. Keep this tab open."}
          </p>
        </>
      ) : nothingToDo ? (
        <>
          <p className="t-hero text-on-dark">All takes generated.</p>
          <p className="t-lead mt-3 text-on-dark-muted">
            {p.remaining == null ? "Every chunk has its takes." : `${p.remaining.toLocaleString()} credits left on the account.`}
          </p>
        </>
      ) : (
        <>
          <p className="t-hero text-on-dark tabular">
            {p.all.credits.toLocaleString()} <span className="text-on-dark-muted">credits.</span>
          </p>
          <p className="t-lead mt-3 text-on-dark-muted">
            {p.all.jobs} {p.all.jobs === 1 ? "take" : "takes"} to generate
            {p.remaining == null ? "." : `, ${p.remaining.toLocaleString()} left.`}
          </p>
          {heavy ? (
            <p className="t-caption mt-2 text-warn-on-dark">That&rsquo;s more than 80% of what&rsquo;s left on the account.</p>
          ) : null}
        </>
      )}

      {p.blockedReason ? (
        <p className="t-caption mt-6 flex items-center gap-2 text-on-dark-muted">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {p.blockedReason}
        </p>
      ) : null}

      {active ? (
        <div className="mt-8 flex items-center gap-3">
          <RunControls run={run} dark />
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!nothingToDo ? (
            <button type="button" onClick={p.onAll} disabled={disabled} className="btn btn-primary btn-primary-dark">
              Generate all
            </button>
          ) : null}
          {nothingToDo && run.failed.length === 0 ? (
            <a href="#audition" className="link link-dark t-lead">
              Audition the takes <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </a>
          ) : null}
          {p.climax.jobs > 0 || p.blockedReason ? (
          <button
            type="button"
            onClick={p.onClimax}
            disabled={disabled || p.climax.jobs === 0}
            className="btn btn-secondary-dark"
          >
            <Flame className="h-4 w-4" aria-hidden="true" /> Climax only
            {p.climax.jobs ? <span className="text-[14px] opacity-70 tabular">{p.climax.jobs}</span> : null}
          </button>
          ) : null}
          {run.failed.length > 0 ? (
            <button type="button" onClick={p.onRetry} disabled={active} className="btn btn-secondary-dark">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retry {run.failed.length} failed
            </button>
          ) : null}
        </div>
      )}

      {showProgress ? (
        <div className="mt-10 w-full max-w-md">
          <ProgressBar {...run.progress} dark />
          <p className="t-caption mt-3 text-on-dark-muted">{progressText(run)}</p>
        </div>
      ) : (
        <p className="t-caption mt-10 max-w-md text-on-dark-muted">
          Cached takes are never regenerated. Re-roll a single chunk from its row in Audition.
        </p>
      )}

      {run.notice ? (
        <div
          role="alert"
          className="t-caption mt-6 flex w-full max-w-md items-start gap-2 rounded-[18px] bg-tile-2 px-4 py-3 text-left text-on-dark shadow-[inset_0_0_0_1px_var(--on-dark-hairline)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error-on-dark" aria-hidden="true" />
          <span className="flex-1 break-words">{run.notice.message}</span>
          <button
            type="button"
            onClick={run.dismissNotice}
            aria-label="Dismiss"
            className="-m-2 flex h-9 w-9 items-center justify-center text-on-dark-muted"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {p.staleCount > 0 && !active ? (
        <button type="button" onClick={p.onClearStale} className="link link-dark t-caption mt-6 h-11 gap-1.5">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear {p.staleCount} stale {p.staleCount === 1 ? "take" : "takes"} from this device
        </button>
      ) : null}
    </div>
  );
}

/** Circular 44px controls, Apple's button-icon-circular. */
export function RunControls({ run, dark }: { run: RunState; dark?: boolean }) {
  if (run.state !== "running" && run.state !== "paused") return null;
  const base = `flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-95`;
  const neutral = dark ? "bg-on-dark/15 text-on-dark hover:bg-on-dark/25" : "bg-chip text-ink hover:bg-hairline";
  return (
    <div className="flex shrink-0 items-center gap-2">
      {run.state === "running" ? (
        <button type="button" onClick={run.pause} aria-label="Pause" title="Pause (in-flight takes finish)" className={`${base} ${neutral}`}>
          <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick={run.resume} aria-label="Resume" title="Resume" className={`${base} bg-primary text-white`}>
          <Play className="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden="true" />
        </button>
      )}
      <button type="button" onClick={run.cancel} aria-label="Cancel run" title="Cancel run" className={`${base} ${neutral}`}>
        <Square className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Phones: Apple's floating sticky bar — frosted parchment, status left, pill right. */
export function RunBar(p: GenerateProps & { visible: boolean }) {
  const { run } = p;
  if (!p.visible) return null;
  const active = run.state === "running" || run.state === "paused";
  return (
    <div className="frosted fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_rgb(0_0_0/0.08)] md:hidden">
      {active ? <ProgressBar {...run.progress} /> : null}
      <div className="flex h-16 items-center gap-3 px-4">
        {active ? (
          <>
            <span className="t-caption min-w-0 flex-1 truncate text-ink">{progressText(run)}</span>
            <RunControls run={run} />
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="t-caption-strong truncate text-ink tabular">
                {p.all.jobs} {p.all.jobs === 1 ? "take" : "takes"} · {p.all.credits.toLocaleString()} credits
              </p>
              {run.failed.length > 0 ? (
                <button type="button" onClick={p.onRetry} className="link t-fine">
                  Retry {run.failed.length} failed
                </button>
              ) : (
                <button
                  type="button"
                  onClick={p.onClimax}
                  disabled={Boolean(p.blockedReason) || p.climax.jobs === 0}
                  className="link t-fine disabled:text-ink-32"
                >
                  Climax only
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={p.onAll}
              disabled={Boolean(p.blockedReason) || p.all.jobs === 0}
              className="btn btn-primary btn-sm"
            >
              Generate all
            </button>
          </>
        )}
      </div>
    </div>
  );
}
