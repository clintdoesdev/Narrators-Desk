"use client";

import { memo, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Flame, Loader2, Timer } from "lucide-react";
import { chunkStatus, STATUS_LABEL, type ChunkStatus } from "@/lib/status";
import type { Chunk, Story } from "@/lib/types";
import { NarrationText } from "./NarrationText";
import { Empty } from "./ValidatePanel";
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
    return <Empty>Chunks appear here once the script parses. Every take plays inline; pick the best one per chunk.</Empty>;
  }

  const toggle = (n: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <div className="space-y-6">
      <div
        className="-mx-5 flex snap-x items-center gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0"
        role="tablist"
        aria-label="Filter chunks"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => onFilter(f.id)}
            className="chip shrink-0 snap-start"
          >
            {f.label}
            <span className="text-ink-48 tabular">{counts[f.id]}</span>
          </button>
        ))}
      </div>
      <p className="t-fine hidden text-center text-ink-48 lg:block">
        <Kbd>J</Kbd> <Kbd>K</Kbd> move between chunks · <Kbd>Space</Kbd> play · <Kbd>1</Kbd>–<Kbd>6</Kbd> pick a take
      </p>

      {groups.length === 0 ? <Empty>Nothing matches this filter.</Empty> : null}

      {groups.map(({ story, all, items }) => {
        const isCollapsed = collapsed.has(story.number);
        const done = all.filter((m) => m.status === "done").length;
        const picked = all.filter((m) => m.pick !== undefined).length;
        return (
          <section key={story.number} className="overflow-hidden rounded-[18px] bg-canvas">
            <button
              type="button"
              onClick={() => toggle(story.number)}
              aria-expanded={!isCollapsed}
              className="flex min-h-16 w-full items-center gap-3 px-5 py-4 text-left md:px-6"
            >
              <div className="min-w-0 flex-1">
                <p className="t-fine text-ink-48">Story {story.number}</p>
                <p className="t-tagline truncate text-ink">{story.title}</p>
              </div>
              <span className="t-caption shrink-0 text-ink-48 tabular">
                {done}/{all.length} done · {picked} picked
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-ink-32 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                aria-hidden="true"
              />
            </button>
            {isCollapsed ? null : (
              <ul className="border-t border-divider">
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
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-canvas px-1 font-sans text-[11px] text-ink-80 shadow-[inset_0_0_0_1px_var(--hairline)]">
      {children}
    </kbd>
  );
}

const STATUS_STYLE: Record<ChunkStatus, string> = {
  idle: "text-ink-48",
  partial: "text-ink-48",
  queued: "text-ink-48",
  generating: "text-primary",
  done: "text-success",
  failed: "text-error",
  stale: "text-warn",
};

const STATUS_DOT: Record<ChunkStatus, string> = {
  idle: "bg-ink-32",
  partial: "bg-ink-48",
  queued: "bg-ink-48",
  generating: "bg-primary animate-pulse",
  done: "bg-success",
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
  const generating = jobs.filter((j) => j.status === "generating").length;
  const queued = jobs.filter((j) => j.status === "queued").length;
  const failures = jobs.filter((j) => j.status === "failed");
  const retrying = jobs.find((j) => j.retry && j.status === "generating");
  const freshCount = takes.filter((t) => t.fresh).length;
  const slots = generating + queued;

  return (
    <li
      id={`chunk-${chunk.id}`}
      data-chunk={chunk.id}
      onPointerDown={() => !active && onActivate(chunk.id, null)}
      className={`relative scroll-mt-28 border-b border-divider px-5 py-5 transition-colors duration-200 last:border-b-0 md:px-6 ${
        active ? "bg-pearl" : ""
      }`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-[3px] transition-colors duration-200 ${active ? "bg-primary" : "bg-transparent"}`}
        aria-hidden="true"
      />
      <div className="t-caption flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-ink">{chunk.id}</span>
        <span className="text-ink-48">{chunk.model}</span>
        {chunk.climax ? (
          <span className="flex items-center gap-1 text-ink-80">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Climax
          </span>
        ) : null}
        <span className={`ml-auto flex items-center gap-1.5 transition-colors duration-200 ${STATUS_STYLE[status]}`}>
          <span className={`h-2 w-2 rounded-full transition-colors duration-200 ${STATUS_DOT[status]}`} aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <p className="t-body mt-2 break-words text-ink">
        <NarrationText text={chunk.text} />
      </p>

      <div className="t-fine mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-48">
        <span className="tabular">{chunk.chars} characters</span>
        {chunk.pauseAfter != null ? (
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" aria-hidden="true" /> {chunk.pauseAfter}s pause after
          </span>
        ) : null}
        <span className="tabular">
          {freshCount} of {chunk.takes} takes
        </span>
        <button
          type="button"
          onClick={() => onReroll(chunk.id)}
          disabled={!canReroll}
          className="link t-caption -my-3 ml-auto h-11 disabled:cursor-not-allowed disabled:text-ink-32 disabled:no-underline"
        >
          {takes.length === 0 ? "Generate" : "Re-roll"}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {retrying?.retry ? (
        <p className="t-caption mt-2 text-warn">
          Retry {retrying.retry.attempt} in {Math.round(retrying.retry.delayMs / 1000)}s — {retrying.retry.message}
        </p>
      ) : null}
      {failures.length > 0 ? (
        <p className="t-caption mt-2 flex items-start gap-1.5 text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="break-words">
            {failures.length === 1 ? `Take ${failures[0].job.take} failed` : `${failures.length} takes failed`}: {failures[0].error}
          </span>
        </p>
      ) : null}

      {takes.length > 0 || slots > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          {Array.from({ length: slots }, (_, i) => (
            <div
              key={`slot-${i}`}
              className="t-caption flex h-12 items-center gap-2 rounded-full bg-parchment px-4 text-ink-48"
            >
              <Loader2 className={`h-4 w-4 ${i < generating ? "animate-spin text-primary" : ""}`} aria-hidden="true" />
              {i < generating ? "Generating" : "Queued"}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
});
