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
};

export function ProgressBar({ total, done, failed }: { total: number; done: number; failed: number }) {
  const pctDone = total ? (done / total) * 100 : 0;
  const pctFailed = total ? (failed / total) * 100 : 0;
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
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
      {p.blockedReason ? (
        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
          {p.blockedReason}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <ModeButton
          icon={<Flame className="h-4 w-4" aria-hidden="true" />}
          label="Generate climax only"
          option={p.climax}
          disabled={disabled || p.climax.jobs === 0}
          onClick={p.onClimax}
        />
        <ModeButton
          icon={<Layers className="h-4 w-4" aria-hidden="true" />}
          label="Generate all"
          option={p.all}
          primary
          disabled={disabled || p.all.jobs === 0}
          onClick={p.onAll}
        />
        <ModeButton
          icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          label="Retry failed"
          option={{ jobs: run.failed.length, credits: -1 }}
          disabled={active || run.failed.length === 0}
          onClick={p.onRetry}
        />
      </div>
      <p className="text-xs text-ink-faint">
        Cached takes are never regenerated. Re-roll a single chunk from its row in Audition.
      </p>

      {showProgress ? (
        <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-muted">{progressText(run)}</span>
            <RunControls run={run} />
          </div>
          <ProgressBar {...run.progress} />
        </div>
      ) : null}

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

function ModeButton({
  icon,
  label,
  option,
  primary,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  option: ModeOption;
  primary?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const meta =
    option.credits < 0
      ? `${option.jobs} ${option.jobs === 1 ? "take" : "takes"}`
      : option.jobs === 0
        ? "All cached"
        : `${option.jobs} takes · ${option.credits.toLocaleString()} credits`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-lg border px-4 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        primary
          ? "border-brass bg-brass text-brass-ink hover:bg-brass-strong disabled:hover:bg-brass"
          : "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className={`font-mono text-[11px] ${primary ? "text-brass-ink/75" : "text-ink-muted"}`}>{meta}</span>
    </button>
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
