"use client";

import { AlertCircle, Flame, Layers, Pause, Play, RotateCcw, Square, Trash2, X } from "lucide-react";
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

export function ProgressBar({ total, done, failed }: { total: number; done: number; failed: number }) {
  const pctDone = total ? (done / total) * 100 : 0;
  const pctFailed = total ? (failed / total) * 100 : 0;
  return (
    <div
      className="flex h-[5px] w-full overflow-hidden rounded-full bg-surface-3"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done + failed}
      aria-label="Run progress"
    >
      <div className="h-full bg-brass transition-[width] duration-500 ease-out" style={{ width: `${pctDone}%` }} />
      <div className="h-full bg-error transition-[width] duration-500 ease-out" style={{ width: `${pctFailed}%` }} />
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

export function GeneratePanel(p: GenerateProps) {
  const { run } = p;
  const active = run.state === "running" || run.state === "paused";
  const disabled = active || Boolean(p.blockedReason);
  const showProgress = run.progress.total > 0;

  return (
    <div className="space-y-5">
      <CreditGauge estimate={p.all.credits} jobs={p.all.jobs} remaining={p.remaining} />

      {p.blockedReason ? (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
          {p.blockedReason}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {p.all.jobs > 0 || p.blockedReason ? (
        <button
          type="button"
          onClick={p.onAll}
          disabled={disabled || p.all.jobs === 0}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brass px-5 sm:flex-1 text-sm font-medium text-brass-ink shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_8px_24px_-12px_rgb(196_154_88/0.6)] transition-colors hover:bg-brass-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-faint disabled:shadow-none"
        >
          <Layers className="h-4 w-4" aria-hidden="true" />
          Generate all · {p.all.jobs} takes
        </button>
        ) : null}
        <div className="flex gap-2">
          <GhostButton onClick={p.onClimax} disabled={disabled || p.climax.jobs === 0}>
            <Flame className="h-4 w-4" aria-hidden="true" /> Climax only
            <Count n={p.climax.jobs} />
          </GhostButton>
          <GhostButton onClick={p.onRetry} disabled={active || run.failed.length === 0} tone={run.failed.length ? "error" : undefined}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retry failed
            <Count n={run.failed.length} />
          </GhostButton>
        </div>
      </div>

      {showProgress ? (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-muted">{progressText(run)}</span>
            <RunControls run={run} />
          </div>
          <ProgressBar {...run.progress} />
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-ink-faint">
          Cached takes are never regenerated. Re-roll a single chunk from its row in Audition.
        </p>
      )}

      {run.notice ? (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            run.notice.tone === "error" ? "border-error/40 bg-error-dim text-error" : "border-line bg-surface text-ink"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 break-words">{run.notice.message}</span>
          <button type="button" onClick={run.dismissNotice} aria-label="Dismiss" className="-m-2 flex h-9 w-9 items-center justify-center">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {p.staleCount > 0 && !active ? (
        <button
          type="button"
          onClick={p.onClearStale}
          className="inline-flex h-11 items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear {p.staleCount} stale {p.staleCount === 1 ? "take" : "takes"} from this device
        </button>
      ) : null}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-mono text-[11px] text-ink-faint tabular">{n}</span>;
}

function GhostButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone?: "error";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${
        tone === "error"
          ? "border-error/50 text-error hover:bg-error-dim"
          : "border-line text-ink hover:border-line-strong hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

/** Estimated spend for "Generate all" drawn against what's left on the account. */
function CreditGauge({ estimate, jobs, remaining }: { estimate: number; jobs: number; remaining: number | null }) {
  if (jobs === 0) {
    return (
      <p className="flex items-baseline gap-2 text-sm text-ink-muted">
        <span className="font-display text-2xl text-done">All takes generated.</span>
        <span className="font-mono text-[11px] text-ink-faint">
          {remaining == null ? "" : `${remaining.toLocaleString()} credits left`}
        </span>
      </p>
    );
  }
  const share = remaining && remaining > 0 ? estimate / remaining : estimate > 0 && remaining === 0 ? 1 : 0;
  const heavy = remaining != null && share > 0.8;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <span className={`font-display text-2xl tabular ${heavy ? "text-warn" : "text-ink"}`}>{estimate.toLocaleString()}</span>{" "}
          credits for {jobs} {jobs === 1 ? "take" : "takes"}
        </p>
        <p className="font-mono text-[11px] text-ink-faint tabular">
          {remaining == null ? "balance unknown" : `of ${remaining.toLocaleString()} left`}
        </p>
      </div>
      <div className="relative mt-2.5 h-[5px] overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${heavy ? "bg-warn" : "bg-brass/80"}`}
          style={{ width: `${Math.min(100, share * 100)}%` }}
        />
        <span className="absolute inset-y-0 left-[80%] w-px bg-ink-faint/60" title="80% of remaining" />
      </div>
    </div>
  );
}

export function RunControls({ run, compact }: { run: RunState; compact?: boolean }) {
  if (run.state !== "running" && run.state !== "paused") return null;
  const size = compact ? "h-11 w-11" : "h-10 w-10";
  return (
    <div className="flex shrink-0 items-center gap-1">
      {run.state === "running" ? (
        <button
          type="button"
          onClick={run.pause}
          aria-label="Pause"
          title="Pause (in-flight takes finish)"
          className={`${size} flex items-center justify-center rounded-md border border-line text-ink hover:bg-surface-2`}
        >
          <Pause className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={run.resume}
          aria-label="Resume"
          title="Resume"
          className={`${size} flex items-center justify-center rounded-md bg-brass text-brass-ink hover:bg-brass-strong`}
        >
          <Play className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={run.cancel}
        aria-label="Cancel run"
        title="Cancel run"
        className={`${size} flex items-center justify-center rounded-md border border-line text-ink-muted hover:border-error hover:text-error`}
      >
        <Square className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Sticky bottom bar for phones: run controls within thumb reach. */
export function RunBar(p: GenerateProps & { visible: boolean }) {
  const { run } = p;
  if (!p.visible) return null;
  const active = run.state === "running" || run.state === "paused";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {active || run.progress.total > 0 ? (
        <div className="px-4 pt-2">
          <ProgressBar {...run.progress} />
        </div>
      ) : null}
      <div className="flex items-center gap-2 px-4 py-2">
        {active ? (
          <>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{progressText(run)}</span>
            <RunControls run={run} compact />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={p.onClimax}
              disabled={Boolean(p.blockedReason) || p.climax.jobs === 0}
              className="flex h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink disabled:opacity-45"
            >
              <Flame className="h-4 w-4" aria-hidden="true" /> Climax
            </button>
            {run.failed.length > 0 ? (
              <button
                type="button"
                onClick={p.onRetry}
                className="flex h-11 items-center gap-1.5 rounded-lg border border-error/50 px-3 text-sm text-error"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> {run.failed.length}
              </button>
            ) : null}
            <button
              type="button"
              onClick={p.onAll}
              disabled={Boolean(p.blockedReason) || p.all.jobs === 0}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brass text-sm font-medium text-brass-ink disabled:bg-surface-3 disabled:text-ink-faint"
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              {p.all.jobs === 0 ? "All cached" : `Generate all · ${p.all.jobs}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
