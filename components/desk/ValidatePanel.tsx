"use client";

import { AlertTriangle, ChevronRight, CircleCheck, OctagonX } from "lucide-react";
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
    return <Empty>Paste a script above. It&rsquo;s checked here before a single credit is spent.</Empty>;
  }

  const over = remaining != null && summary.credits > remaining;

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-8 md:grid-cols-6">
        <Stat label="Chunks" value={summary.chunks} />
        <Stat label="Stories" value={summary.stories} />
        <Stat label="v2 / v3" value={`${summary.v2}/${summary.v3}`} />
        <Stat label="Characters" value={summary.characters} />
        <Stat label="Est. credits" value={summary.credits} />
        <Stat label="Remaining" value={remaining == null ? "—" : remaining} tone={over ? "error" : undefined} />
      </dl>

      {errors.length === 0 && warnings.length === 0 ? (
        <p className="t-body flex items-center justify-center gap-2 text-success">
          <CircleCheck className="h-5 w-5" aria-hidden="true" /> Clean script. Ready to generate.
        </p>
      ) : null}
      {over ? (
        <p className="t-caption text-center text-error">A full run needs more credits than remain on the account.</p>
      ) : null}

      {errors.length > 0 || warnings.length > 0 ? (
        <div className="overflow-hidden rounded-[18px] bg-canvas shadow-[inset_0_0_0_1px_var(--hairline)]">
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
      ) : null}
    </div>
  );
}

export function Empty({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <p className={`t-body mx-auto max-w-lg text-center ${dark ? "text-on-dark-muted" : "text-ink-48"}`}>{children}</p>;
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "error" }) {
  return (
    <div className="flex flex-col-reverse text-center">
      <dt className="t-caption mt-2 text-ink-48">{label}</dt>
      <dd className={`font-display text-[32px] leading-none font-semibold tracking-tight tabular md:text-[40px] ${tone === "error" ? "text-error" : "text-ink"}`}>
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
  return (
    <section className="border-b border-divider last:border-b-0">
      <h3 className={`t-caption-strong flex items-center gap-2 px-5 pt-5 pb-2 ${color}`}>
        <Icon className="h-4 w-4" aria-hidden="true" /> {title}
      </h3>
      <ul className="max-h-80 overflow-y-auto pb-2">
        {issues.map((issue, i) => (
          <li key={`${issue.line}-${i}`}>
            <button
              type="button"
              onClick={() => onJump(issue.line)}
              className="group flex min-h-11 w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-parchment"
            >
              <span className="t-fine w-9 shrink-0 font-mono text-ink-48 tabular">L{issue.line}</span>
              <span className="t-caption min-w-0 flex-1 break-words text-ink">{issue.message}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-32 group-hover:text-primary" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
