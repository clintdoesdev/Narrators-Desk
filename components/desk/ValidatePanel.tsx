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
    return <Empty>Paste a script and it&rsquo;s checked here before a single credit is spent.</Empty>;
  }

  const over = remaining != null && summary.credits > remaining;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-3 border-y border-line">
        <Stat label="Chunks" value={summary.chunks} />
        <Stat label="Stories" value={summary.stories} />
        <Stat label="v2 · v3" value={`${summary.v2}·${summary.v3}`} />
        <Stat label="Characters" value={summary.characters} />
        <Stat label="Est. credits" value={summary.credits} accent />
        <Stat label="Remaining" value={remaining == null ? "—" : remaining} tone={over ? "error" : undefined} />
      </dl>

      {errors.length === 0 && warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-done">
          <CircleCheck className="h-4 w-4" aria-hidden="true" /> Clean script. Ready to generate.
        </p>
      ) : null}
      {over ? (
        <p className="text-xs text-error">A full run needs more credits than remain on the account.</p>
      ) : null}

      {errors.length > 0 ? (
        <IssueList
          title={`${errors.length} ${errors.length === 1 ? "error" : "errors"} to fix before generating`}
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

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="border-l border-line-strong py-1 pl-4 text-sm leading-relaxed text-ink-muted">{children}</p>;
}

function Stat({
  label,
  value,
  tone,
  accent,
}: {
  label: string;
  value: number | string;
  tone?: "error";
  accent?: boolean;
}) {
  return (
    <div className="border-l border-line py-3 pr-2 pl-3 [&:nth-child(3n+1)]:border-l-0 [&:nth-child(3n+1)]:pl-0 [&:nth-child(n+4)]:border-t">
      <dt className="text-[11px] text-ink-faint">{label}</dt>
      <dd
        className={`mt-1 font-display text-[22px] leading-none tabular ${
          tone === "error" ? "text-error" : accent ? "text-brass-strong" : "text-ink"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </dd>
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
  const bar = tone === "error" ? "bg-error" : "bg-warn";
  return (
    <section className="relative pl-4">
      <span className={`absolute inset-y-1 left-0 w-[2px] rounded-full ${bar} opacity-70`} aria-hidden="true" />
      <h3 className={`mb-1 flex items-center gap-2 text-[13px] font-medium ${color}`}>
        <Icon className="h-4 w-4" aria-hidden="true" /> {title}
      </h3>
      <ul className="-mx-2 max-h-72 overflow-y-auto">
        {issues.map((issue, i) => (
          <li key={`${issue.line}-${i}`}>
            <button
              type="button"
              onClick={() => onJump(issue.line)}
              className="group flex min-h-11 w-full items-baseline gap-3 rounded-md px-2 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <span className="w-9 shrink-0 font-mono text-[11px] text-ink-faint tabular group-hover:text-brass">L{issue.line}</span>
              <span className="min-w-0 break-words">{issue.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
