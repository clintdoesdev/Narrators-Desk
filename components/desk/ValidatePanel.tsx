"use client";

import { AlertTriangle, CircleCheck, OctagonX } from "lucide-react";
import type { ScriptSummary } from "@/lib/credits";
import type { Issue } from "@/lib/types";

export function ValidatePanel({
  summary,
  errors,
  warnings,
  remaining,
  hasScript,
  onJump,
}: {
  summary: ScriptSummary;
  errors: Issue[];
  warnings: Issue[];
  remaining: number | null;
  hasScript: boolean;
  onJump: (line: number) => void;
}) {
  if (!hasScript) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
        Paste a script above and it will be checked here before any credits are spent.
      </p>
    );
  }

  const over = remaining != null && summary.credits > remaining;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Chunks" value={summary.chunks} />
        <Stat label="Stories" value={summary.stories} />
        <Stat label="v2 / v3" value={`${summary.v2} / ${summary.v3}`} />
        <Stat label="Characters" value={summary.characters} />
        <Stat label="Est. credits" value={summary.credits} hint={`${summary.billedCharacters.toLocaleString()} chars × takes`} />
        <Stat
          label="Remaining"
          value={remaining == null ? "—" : remaining}
          tone={over ? "error" : undefined}
          hint={over ? "Not enough for a full run" : undefined}
        />
      </dl>

      {errors.length === 0 && warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-done">
          <CircleCheck className="h-4 w-4" aria-hidden="true" /> Script is clean. Ready to generate.
        </p>
      ) : null}

      {errors.length > 0 ? (
        <IssueList
          title={`${errors.length} ${errors.length === 1 ? "error" : "errors"} — fix before generating`}
          issues={errors}
          tone="error"
          onJump={onJump}
        />
      ) : null}
      {warnings.length > 0 ? (
        <IssueList
          title={`${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}`}
          issues={warnings}
          tone="warn"
          onJump={onJump}
        />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "error";
}) {
  return (
    <div className="bg-surface px-3 py-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 font-mono text-lg tabular-nums ${tone === "error" ? "text-error" : "text-ink"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
      {hint ? <p className={`mt-0.5 text-[11px] ${tone === "error" ? "text-error" : "text-ink-faint"}`}>{hint}</p> : null}
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
  onJump,
}: {
  title: string;
  issues: Issue[];
  tone: "error" | "warn";
  onJump: (line: number) => void;
}) {
  const Icon = tone === "error" ? OctagonX : AlertTriangle;
  const color = tone === "error" ? "text-error" : "text-warn";
  const border = tone === "error" ? "border-error" : "border-warn";
  return (
    <section className={`border-l-2 ${border} pl-3`}>
      <h3 className={`mb-1 flex items-center gap-2 text-sm font-medium ${color}`}>
        <Icon className="h-4 w-4" aria-hidden="true" /> {title}
      </h3>
      <ul className="max-h-72 overflow-y-auto">
        {issues.map((issue, i) => (
          <li key={`${issue.line}-${i}`}>
            <button
              type="button"
              onClick={() => onJump(issue.line)}
              className="flex min-h-11 w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm text-ink hover:bg-surface-2"
            >
              <span className="w-12 shrink-0 pt-px font-mono text-xs text-ink-faint tabular-nums">L{issue.line}</span>
              <span className="min-w-0 break-words">{issue.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
