"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Loader2, Play, X } from "lucide-react";
import { isHeavyRun } from "@/lib/credits";

export function ConfirmSheet({
  title,
  jobCount,
  chars,
  credits,
  remaining,
  remainingLoading,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  jobCount: number;
  chars: number;
  credits: number;
  remaining: number | null;
  remainingLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const heavy = isHeavyRun(credits, remaining);
  const exceeds = remaining != null && credits > remaining;
  const pct = remaining && remaining > 0 ? Math.round((credits / remaining) * 100) : null;

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"
      >
        <span className="mx-auto -mt-2 mb-3 block h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
        <div className="mb-4 flex items-start gap-3">
          <h2 id="confirm-title" className="font-display text-xl leading-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-2 -mr-2 ml-auto flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {children}

        <p className="mb-4">
          <span className={`font-display text-4xl tabular ${heavy ? "text-warn" : "text-brass-strong"}`}>
            {credits.toLocaleString()}
          </span>
          <span className="ml-2 text-sm text-ink-muted">estimated credits</span>
        </p>
        <dl className="divide-y divide-line border-y border-line text-sm">
          <Row label="Takes to generate" value={jobCount.toLocaleString()} />
          <Row label="Characters (chars × takes)" value={chars.toLocaleString()} />
          <Row
            label="Remaining credits"
            value={remainingLoading ? "Checking…" : remaining == null ? "Unavailable" : remaining.toLocaleString()}
          />
          {remaining != null && !remainingLoading ? (
            <Row label="Left after this run" value={Math.max(0, remaining - credits).toLocaleString()} />
          ) : null}
        </dl>

        {heavy ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn-dim px-3 py-2 text-sm text-warn">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {exceeds
              ? "This run needs more credits than you have left. It will stop when ElevenLabs runs out."
              : `This run uses about ${pct}% of your remaining credits.`}
          </p>
        ) : null}
        {remaining == null && !remainingLoading ? (
          <p className="mt-3 text-xs text-ink-muted">Couldn&rsquo;t check remaining credits. The estimate is still accurate.</p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-lg border border-line text-sm text-ink hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={jobCount === 0}
            className={`flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-faint ${
              heavy
                ? "border border-warn bg-warn-dim text-warn hover:bg-warn/20"
                : "bg-brass text-brass-ink hover:bg-brass-strong"
            }`}
          >
            {remainingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : heavy ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {jobCount === 0 ? "Nothing to generate" : heavy ? "Start anyway" : "Start run"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono text-ink tabular-nums">{value}</dd>
    </div>
  );
}
