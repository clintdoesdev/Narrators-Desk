"use client";

import { memo, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, Dices, Flame, Loader2, Timer } from "lucide-react";
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
    return (
      <Empty>Chunks appear here once the script parses. Every take plays inline; tick the best one per chunk.</Empty>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-1 border-b border-line" role="tablist" aria-label="Filter chunks">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => onFilter(f.id)}
            className={`relative -mb-px flex h-11 items-center gap-1.5 px-2.5 text-sm transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:transition-colors ${
              filter === f.id ? "text-ink after:bg-brass" : "text-ink-muted after:bg-transparent hover:text-ink"
            }`}
          >
            {f.label}
            <span className={`font-mono text-[10px] tabular ${filter === f.id ? "text-brass" : "text-ink-faint"}`}>{counts[f.id]}</span>
          </button>
        ))}
        <span className="mb-3 ml-auto hidden gap-1 text-[11px] text-ink-faint xl:flex">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd> move <Kbd>space</Kbd> play <Kbd>1–6</Kbd> pick
        </span>
      </div>

      {groups.length === 0 ? <p className="py-2 text-sm text-ink-muted">Nothing matches this filter.</p> : null}

      {groups.map(({ story, all, items }) => {
        const isCollapsed = collapsed.has(story.number);
        const done = all.filter((m) => m.status === "done").length;
        const picked = all.filter((m) => m.pick !== undefined).length;
        return (
          <section key={story.number}>
            <button
              type="button"
              onClick={() => toggle(story.number)}
              aria-expanded={!isCollapsed}
              className="group flex min-h-12 w-full items-center gap-3 text-left"
            >
              <span className="font-mono text-[11px] text-brass">S{story.number}</span>
              <span className="min-w-0 flex-1 truncate font-display text-lg leading-tight tracking-tight">{story.title}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-faint tabular">
                {done}/{all.length} done · {picked} picked
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:text-ink ${isCollapsed ? "-rotate-90" : ""}`}
                aria-hidden="true"
              />
            </button>
            <div className="mb-1 h-[2px] overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
              <div className="h-full bg-done/70 transition-[width] duration-500" style={{ width: `${(done / all.length) * 100}%` }} />
            </div>
            {isCollapsed ? null : (
              <ul className="divide-y divide-line/70">
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
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line border-b-line-strong bg-surface px-1 font-mono text-[10px] text-ink-muted">
      {children}
    </kbd>
  );
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
      className={`relative scroll-mt-24 py-4 pl-4 transition-colors duration-300 ${active ? "bg-surface/60" : ""}`}
    >
      <span
        className={`absolute inset-y-3 left-0 w-[2px] rounded-full transition-colors duration-300 ${active ? "bg-brass" : "bg-transparent"}`}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pr-1">
        <span className="font-mono text-[13px] text-ink">{chunk.id}</span>
        <span
          className={`rounded px-1.5 py-px font-mono text-[10px] leading-4 ring-1 ring-inset ${
            chunk.model === "v3" ? "text-tag ring-tag/35" : "text-ink-muted ring-line-strong"
          }`}
        >
          {chunk.model}
        </span>
        {chunk.climax ? (
          <span className="flex items-center gap-1 text-[11px] text-brass">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Climax
          </span>
        ) : null}
        <span className={`ml-auto flex items-center gap-1.5 text-[11px] transition-colors duration-300 ${STATUS_STYLE[status]}`}>
          <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${STATUS_DOT[status]}`} aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <p className="narration mt-2 text-[17px] leading-[1.6] break-words text-ink/95 lg:text-[16px]">
        <NarrationText text={chunk.text} />
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint">
        <span className="tabular">{chunk.chars} chars</span>
        {chunk.pauseAfter != null ? (
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" aria-hidden="true" /> {chunk.pauseAfter}s after
          </span>
        ) : null}
        <span className="tabular">
          {freshCount}/{chunk.takes} takes
        </span>
        <button
          type="button"
          onClick={() => onReroll(chunk.id)}
          disabled={!canReroll}
          className="-my-3 ml-auto flex h-11 items-center gap-1.5 px-1 font-sans text-xs text-ink-muted transition-colors hover:text-brass disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Dices className="h-4 w-4" aria-hidden="true" />
          {takes.length === 0 ? "Generate" : "Re-roll"}
        </button>
      </div>

      {retrying?.retry ? (
        <p className="mt-2 text-xs text-warn">
          Retry {retrying.retry.attempt} in {Math.round(retrying.retry.delayMs / 1000)}s — {retrying.retry.message}
        </p>
      ) : null}
      {failures.length > 0 ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-error">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="break-words">
            {failures.length === 1 ? `Take ${failures[0].job.take} failed` : `${failures.length} takes failed`}: {failures[0].error}
          </span>
        </p>
      ) : null}

      {takes.length > 0 || slots > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
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
              className="flex h-12 items-center gap-2 rounded-lg border border-dashed border-line px-3 font-mono text-[11px] text-ink-faint"
            >
              <Loader2 className={`h-3.5 w-3.5 ${i < generating ? "animate-spin text-brass" : ""}`} aria-hidden="true" />
              {i < generating ? "generating" : "queued"}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
});
