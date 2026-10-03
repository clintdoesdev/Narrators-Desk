"use client";

import { memo, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, Dices, Flame, Loader2, Timer } from "lucide-react";
import { chunkStatus, STATUS_LABEL, type ChunkStatus } from "@/lib/status";
import type { Chunk, Story } from "@/lib/types";
import { NarrationText } from "./NarrationText";
import { TakePlayer } from "./TakePlayer";
import type { TakeView } from "./useTakes";
import type { JobView } from "./useRun";

export type Filter = "all" | "climax" | "v3" | "failed" | "unpicked";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "climax", label: "Climax" },
  { id: "v3", label: "v3" },
  { id: "failed", label: "Failed" },
  { id: "unpicked", label: "Unpicked" },
];

export type ChunkModel = {
  chunk: Chunk;
  takes: TakeView[];
  jobs: JobView[];
  status: ChunkStatus;
  pick: number | undefined;
};

export function buildChunkModels(
  chunks: Chunk[],
  byChunk: Map<string, TakeView[]>,
  jobs: Record<string, JobView>,
  picks: Record<string, number>,
): ChunkModel[] {
  const jobsByChunk = new Map<string, JobView[]>();
  for (const j of Object.values(jobs)) {
    const list = jobsByChunk.get(j.job.chunkId) ?? [];
    list.push(j);
    jobsByChunk.set(j.job.chunkId, list);
  }
  return chunks.map((chunk) => {
    const takes = byChunk.get(chunk.id) ?? [];
    const cj = jobsByChunk.get(chunk.id) ?? [];
    return { chunk, takes, jobs: cj, status: chunkStatus(chunk.takes, takes, cj), pick: picks[chunk.id] };
  });
}

export function matchesFilter(m: ChunkModel, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "climax":
      return m.chunk.climax;
    case "v3":
      return m.chunk.model === "v3";
    case "failed":
      return m.jobs.some((j) => j.status === "failed");
    case "unpicked":
      return m.pick === undefined && m.takes.some((t) => t.fresh);
  }
}

export function AuditionList({
  models,
  stories,
  filter,
  onFilter,
  activeChunkId,
  activeTake,
  canReroll,
  onPick,
  onReroll,
  onActivate,
}: {
  models: ChunkModel[];
  stories: Story[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  activeChunkId: string | null;
  activeTake: number | null;
  canReroll: boolean;
  onPick: (chunkId: string, take: number) => void;
  onReroll: (chunkId: string) => void;
  onActivate: (chunkId: string, take: number | null) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.id] = models.filter((m) => matchesFilter(m, f.id)).length;
    return out;
  }, [models]);

  const groups = useMemo(() => {
    const visible = models.filter((m) => matchesFilter(m, filter));
    return stories
      .map((s) => ({
        story: s,
        all: models.filter((m) => m.chunk.story === s.number),
        items: visible.filter((m) => m.chunk.story === s.number),
      }))
      .filter((g) => g.items.length > 0);
  }, [models, stories, filter]);

  if (models.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
        Chunks appear here once the script parses. Generated takes play inline; pick the best one per chunk.
      </p>
    );
  }

  const toggle = (n: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter chunks">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => onFilter(f.id)}
            className={`flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
              filter === f.id
                ? "border-brass bg-brass-dim text-brass-strong"
                : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {f.label}
            <span className="font-mono text-[11px] tabular-nums opacity-70">{counts[f.id]}</span>
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-ink-faint lg:inline">
          <Kbd>j</Kbd>/<Kbd>k</Kbd> move · <Kbd>space</Kbd> play · <Kbd>1</Kbd>–<Kbd>6</Kbd> pick
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="px-1 py-4 text-sm text-ink-muted">Nothing matches this filter.</p>
      ) : null}

      {groups.map(({ story, all, items }) => {
        const isCollapsed = collapsed.has(story.number);
        const done = all.filter((m) => m.status === "done").length;
        const picked = all.filter((m) => m.pick !== undefined).length;
        return (
          <section key={story.number} className="overflow-hidden rounded-lg border border-line">
            <button
              type="button"
              onClick={() => toggle(story.number)}
              aria-expanded={!isCollapsed}
              className="flex min-h-12 w-full items-center gap-3 bg-surface-2 px-3 py-2 text-left hover:bg-surface-3"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                aria-hidden="true"
              />
              <span className="font-mono text-xs text-brass">S{story.number}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{story.title}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
                {done}/{all.length} done · {picked} picked
              </span>
            </button>
            {isCollapsed ? null : (
              <ul className="divide-y divide-line">
                {items.map((m) => (
                  <ChunkRow
                    key={m.chunk.id}
                    model={m}
                    active={activeChunkId === m.chunk.id}
                    activeTake={activeChunkId === m.chunk.id ? activeTake : null}
                    canReroll={canReroll}
                    onPick={onPick}
                    onReroll={onReroll}
                    onActivate={onActivate}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-surface px-1 font-mono text-[10px] text-ink-muted">{children}</kbd>;
}

const STATUS_STYLE: Record<ChunkStatus, string> = {
  idle: "text-ink-faint",
  partial: "text-ink-muted",
  queued: "text-ink-muted",
  generating: "text-brass",
  done: "text-done",
  failed: "text-error",
  stale: "text-warn",
};

const STATUS_DOT: Record<ChunkStatus, string> = {
  idle: "bg-line-strong",
  partial: "bg-ink-muted",
  queued: "bg-ink-muted",
  generating: "bg-brass animate-pulse",
  done: "bg-done",
  failed: "bg-error",
  stale: "bg-warn",
};

const ChunkRow = memo(function ChunkRow({
  model,
  active,
  activeTake,
  canReroll,
  onPick,
  onReroll,
  onActivate,
}: {
  model: ChunkModel;
  active: boolean;
  activeTake: number | null;
  canReroll: boolean;
  onPick: (chunkId: string, take: number) => void;
  onReroll: (chunkId: string) => void;
  onActivate: (chunkId: string, take: number | null) => void;
}) {
  const { chunk, takes, jobs, status, pick } = model;
  const pendingJobs = jobs.filter((j) => j.status !== "failed");
  const failures = jobs.filter((j) => j.status === "failed");
  const retrying = jobs.find((j) => j.retry && j.status === "generating");
  const freshCount = takes.filter((t) => t.fresh).length;

  return (
    <li
      id={`chunk-${chunk.id}`}
      data-chunk={chunk.id}
      onPointerDown={() => !active && onActivate(chunk.id, null)}
      className={`scroll-mt-28 border-l-2 px-3 py-3 transition-colors duration-300 lg:grid lg:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,22rem)] lg:gap-4 ${
        active ? "border-l-brass bg-surface" : "border-l-transparent bg-bg"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mb-0 lg:flex-col lg:items-start">
        <span className="font-mono text-sm text-ink">{chunk.id}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded border px-1.5 py-px font-mono text-[10px] ${
              chunk.model === "v3" ? "border-tag/40 text-tag" : "border-line-strong text-ink-muted"
            }`}
          >
            {chunk.model}
          </span>
          {chunk.climax ? (
            <span className="flex items-center gap-0.5 text-[11px] text-brass" title="Climax">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only lg:not-sr-only">Climax</span>
            </span>
          ) : null}
        </div>
        <span className={`ml-auto flex items-center gap-1.5 text-[11px] transition-colors duration-300 lg:ml-0 ${STATUS_STYLE[status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${STATUS_DOT[status]}`} aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-[15px] leading-relaxed break-words text-ink lg:text-sm">
          <NarrationText text={chunk.text} />
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint">
          <span>{chunk.chars} chars</span>
          {chunk.pauseAfter != null ? (
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" aria-hidden="true" />
              pause {chunk.pauseAfter}s
            </span>
          ) : null}
          <span>
            {freshCount}/{chunk.takes} takes
          </span>
        </div>
        {retrying?.retry ? (
          <p className="mt-1.5 text-xs text-warn">
            Retry {retrying.retry.attempt} in {Math.round(retrying.retry.delayMs / 1000)}s — {retrying.retry.message}
          </p>
        ) : null}
        {failures.length > 0 ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-error">
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="break-words">
              {failures.length === 1 ? `Take ${failures[0].job.take} failed` : `${failures.length} takes failed`}:{" "}
              {failures[0].error}
            </span>
          </p>
        ) : null}
      </div>

      <div className="mt-3 space-y-1.5 lg:mt-0">
        {takes.map((t) => (
          <TakePlayer
            key={t.key}
            playerKey={`${chunk.id}/t${t.take}`}
            take={t.take}
            blob={t.blob}
            seed={t.seed}
            fresh={t.fresh}
            picked={pick === t.take}
            active={active && activeTake === t.take}
            onPick={() => onPick(chunk.id, t.take)}
            onFocus={() => onActivate(chunk.id, t.take)}
          />
        ))}
        {pendingJobs.length > 0 ? (
          <p className="flex h-11 items-center gap-2 px-1 text-xs text-ink-muted">
            <Loader2 className={`h-3.5 w-3.5 ${pendingJobs.some((j) => j.status === "generating") ? "animate-spin text-brass" : ""}`} aria-hidden="true" />
            {pendingJobs.filter((j) => j.status === "generating").length} generating · {pendingJobs.filter((j) => j.status === "queued").length} queued
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => onReroll(chunk.id)}
          disabled={!canReroll}
          className="flex h-11 items-center gap-1.5 rounded-md px-1 text-xs text-ink-muted hover:text-brass disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Dices className="h-4 w-4" aria-hidden="true" />
          {takes.length === 0 ? "Generate this chunk" : "Re-roll more takes"}
        </button>
      </div>
    </li>
  );
});
