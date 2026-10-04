"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
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
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-t-[18px] bg-canvas px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[18px] sm:pt-6"
      >
        <span className="mx-auto mb-4 block h-1 w-9 rounded-full bg-hairline sm:hidden" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <h2 id="confirm-title" className="t-tagline text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-2 -mr-2 ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-48 transition-colors hover:bg-parchment hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 mb-5">
          <span className={`t-hero tabular ${heavy ? "text-warn" : "text-ink"}`}>{credits.toLocaleString()}</span>
          <span className="t-body ml-2 text-ink-48">credits</span>
        </p>

        {children}

        <dl className="t-caption divide-y divide-divider border-y border-divider">
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
          <p className="t-caption mt-4 flex items-start gap-2 text-warn">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {exceeds
              ? "This run needs more credits than you have left. It will stop when ElevenLabs runs out."
              : `This run uses about ${pct}% of your remaining credits.`}
          </p>
        ) : null}
        {remaining == null && !remainingLoading ? (
          <p className="t-fine mt-4 text-ink-48">Couldn&rsquo;t check remaining credits. The estimate is still accurate.</p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={jobCount === 0}
            className={`btn flex-[1.4] ${heavy ? "btn-warn" : "btn-primary"}`}
          >
            {remainingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : heavy ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : null}
            {jobCount === 0 ? "Nothing to generate" : heavy ? "Start anyway" : "Start run"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-ink-48">{label}</dt>
      <dd className="text-ink tabular">{value}</dd>
    </div>
  );
}
