"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { SectionLabel } from "@/components/SectionLabel";
import { getMeta, setMeta } from "@/lib/cache";
import { summarize } from "@/lib/credits";
import { EXAMPLE_SCRIPT } from "@/lib/example";
import { parseScript } from "@/lib/parser";
import { jobsCredits, planJobs, type ExistingTake, type Job, type RunMode } from "@/lib/runner";
import { VOICE_CONFIG } from "@/lib/voice-config";
import { AuditionList, buildChunkModels, matchesFilter, type Filter } from "./AuditionList";
import { ConfirmSheet } from "./ConfirmSheet";
import { ExportPanel } from "./ExportPanel";
import { GeneratePanel, RunBar } from "./GeneratePanel";
import { ScriptEditor, type ScriptEditorHandle } from "./ScriptEditor";
import { togglePlayer } from "./TakePlayer";
import { ValidatePanel } from "./ValidatePanel";
import { useOnline } from "./useOnline";
import { useRun } from "./useRun";
import { useTakes } from "./useTakes";
import { useUsage } from "./useUsage";

const SCRIPT_KEY = "script";
const perChar = (m: Job["model"]) => VOICE_CONFIG[m].creditsPerChar;

type Pending = { mode: RunMode; title: string; jobs: Job[] };

export function Desk() {
  const [script, setScript] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<{ chunkId: string; take: number | null } | null>(null);
  const editor = useRef<ScriptEditorHandle>(null);
  const usage = useUsage();
  const online = useOnline();

  useEffect(() => {
    getMeta<string>(SCRIPT_KEY)
      .then((s) => {
        if (s) setScript(s);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => setMeta(SCRIPT_KEY, script).catch(() => {}), 400);
    return () => window.clearTimeout(t);
  }, [script, hydrated]);

  const deferred = useDeferredValue(script);
  const parsed = useMemo(() => parseScript(deferred), [deferred]);
  const summary = useMemo(() => summarize(parsed.chunks), [parsed.chunks]);
  const video = parsed.video || null;
  const chunks = parsed.chunks;

  useEffect(() => {
    document.title = video ? `Narrator's Desk — ${video}` : "Narrator's Desk";
  }, [video]);

  const takes = useTakes(video, chunks);
  const refreshUsage = usage.refresh;
  const run = useRun(video, takes.addTake, () => void refreshUsage());

  // Going offline mid-run: pause instead of burning retries; resume on reconnect.
  const autoPaused = useRef(false);
  const { state: runState, pause: pauseRun, resume: resumeRun } = run;
  useEffect(() => {
    if (!online && runState === "running") {
      autoPaused.current = true;
      pauseRun();
    } else if (online && runState === "paused" && autoPaused.current) {
      autoPaused.current = false;
      resumeRun();
    }
  }, [online, runState, pauseRun, resumeRun]);

  useEffect(() => {
    if (runState !== "running" && runState !== "paused") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [runState]);

  const existing = useMemo<ExistingTake[]>(() => {
    const out: ExistingTake[] = [];
    for (const list of takes.byChunk.values()) for (const t of list) out.push({ chunkId: t.chunkId, take: t.take, textHash: t.textHash });
    return out;
  }, [takes.byChunk]);

  // Counts for the mode buttons (seeds are irrelevant here).
  const modeCounts = useMemo(() => {
    const count = (mode: RunMode) => {
      const jobs = planJobs(mode, chunks, existing, () => 0);
      return { jobs: jobs.length, credits: jobsCredits(jobs, perChar).credits };
    };
    return { climax: count({ kind: "climax" }), all: count({ kind: "all" }) };
  }, [chunks, existing]);

  const blockedReason = !script.trim()
    ? "Paste a script to start."
    : parsed.errors.length > 0
      ? `Fix ${parsed.errors.length} validation ${parsed.errors.length === 1 ? "error" : "errors"} before generating.`
      : !video
        ? "Add a valid @@VIDEO header."
        : chunks.length === 0
          ? "No narration found. Add [AUDIO — v2] or [AUDIO — v3] blocks."
          : !online
            ? "You're offline. Generation resumes when you reconnect."
            : takes.loading
              ? "Loading cached takes…"
              : null;

  const openConfirm = useCallback(
    (mode: RunMode, title: string) => {
      setPending({ mode, title, jobs: planJobs(mode, chunks, existing) });
      setCheckingCredits(true);
      void refreshUsage().finally(() => setCheckingCredits(false));
    },
    [chunks, existing, refreshUsage],
  );

  const openReroll = useCallback(
    (chunkId: string) => {
      const c = chunks.find((x) => x.id === chunkId);
      if (!c) return;
      openConfirm({ kind: "reroll", chunkId, count: c.takes }, `Re-roll ${chunkId}`);
    },
    [chunks, openConfirm],
  );

  const setRerollCount = (count: number) => {
    if (!pending || pending.mode.kind !== "reroll") return;
    const mode: RunMode = { ...pending.mode, count: Math.min(6, Math.max(1, count)) };
    setPending({ ...pending, mode, jobs: planJobs(mode, chunks, existing) });
  };

  const confirm = () => {
    if (!pending) return;
    run.start(pending.jobs);
    setPending(null);
  };

  const closeConfirm = useCallback(() => setPending(null), []);

  const jump = useCallback((line: number) => editor.current?.jumpToLine(line), []);

  const models = useMemo(
    () => buildChunkModels(chunks, takes.byChunk, run.jobs, takes.picks),
    [chunks, takes.byChunk, run.jobs, takes.picks],
  );

  const setPick = takes.setPick;
  const onPick = useCallback((chunkId: string, take: number) => setPick(chunkId, take), [setPick]);
  const onActivate = useCallback((chunkId: string, take: number | null) => setActive({ chunkId, take }), []);

  // Keyboard: j/k move between chunks, space plays the focused take, 1–6 pick.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pending || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const visible = models.filter((m) => matchesFilter(m, filter));
      if (visible.length === 0) return;
      const idx = active ? visible.findIndex((m) => m.chunk.id === active.chunkId) : -1;
      const defaultTake = (m: (typeof visible)[number]) =>
        m.pick ?? m.takes.find((t) => t.fresh)?.take ?? m.takes[0]?.take ?? null;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const next = e.key === "j" ? Math.min(visible.length - 1, idx + 1) : Math.max(0, idx === -1 ? 0 : idx - 1);
        const m = visible[next];
        setActive({ chunkId: m.chunk.id, take: defaultTake(m) });
        document.getElementById(`chunk-${m.chunk.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (idx === -1) return;
      const m = visible[idx];
      if (e.key === " ") {
        const take = active?.take ?? defaultTake(m);
        if (take == null) return;
        e.preventDefault();
        togglePlayer(`${m.chunk.id}/t${take}`);
        if (active?.take == null) setActive({ chunkId: m.chunk.id, take });
        return;
      }
      if (/^[1-6]$/.test(e.key)) {
        const take = Number(e.key);
        if (m.takes.some((t) => t.take === take && t.fresh)) {
          e.preventDefault();
          setPick(m.chunk.id, take);
          setActive({ chunkId: m.chunk.id, take });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [models, filter, active, pending, setPick]);

  const generateProps = {
    run,
    climax: modeCounts.climax,
    all: modeCounts.all,
    blockedReason,
    staleCount: takes.staleKeys.length,
    onClimax: () => openConfirm({ kind: "climax" }, "Generate climax only"),
    onAll: () => openConfirm({ kind: "all" }, "Generate all"),
    onRetry: () =>
      openConfirm(
        { kind: "retry", failed: run.failed.map((j) => ({ chunkId: j.chunkId, take: j.take })) },
        "Retry failed takes",
      ),
    onClearStale: () => void takes.clearStale(),
    remaining: usage.remaining,
  };

  const pendingCost = pending ? jobsCredits(pending.jobs, perChar) : null;

  return (
    <div className="min-h-dvh">
      <Header video={video} credits={usage.view} online={online} />
      <main className="mx-auto max-w-7xl px-4 pt-7 pb-36 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:px-8 lg:pt-10 lg:pb-20">
        <div className="space-y-12 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1 lg:pb-4">
        <section className="space-y-5" aria-labelledby="s-script">
          <SectionLabel num="01" label="Script" id="s-script" aside={video ? <span className="sm:hidden">{video}</span> : null} />
          {hydrated ? (
            <ScriptEditor ref={editor} value={script} onChange={setScript} onLoadExample={() => setScript(EXAMPLE_SCRIPT)} />
          ) : (
            <div className="h-48 animate-pulse rounded-lg border border-line bg-surface" aria-label="Loading saved script" />
          )}
        </section>

        <section className="space-y-5" aria-labelledby="s-validate">
          <SectionLabel num="02" label="Validate" id="s-validate" />
          <ValidatePanel
            summary={summary}
            errors={parsed.errors}
            warnings={parsed.warnings}
            remaining={usage.remaining}
            hasScript={script.trim().length > 0}
            onJump={jump}
          />
        </section>
        </div>

        <div className="mt-12 space-y-14 lg:mt-0">

        <section className="space-y-5" aria-labelledby="s-generate">
          <SectionLabel num="03" label="Generate" id="s-generate" />
          {takes.error ? <p className="text-sm text-error">{takes.error}</p> : null}
          {usage.view.state === "error" ? (
            <p className="text-sm text-ink-muted">
              <span className="text-error">Credits unavailable:</span> {usage.view.message}
            </p>
          ) : null}
          <GeneratePanel {...generateProps} />
        </section>

        <section className="space-y-5" aria-labelledby="s-audition">
          <SectionLabel
            num="04"
            label="Audition"
            id="s-audition"
            aside={chunks.length ? `${Object.keys(takes.picks).length}/${chunks.length} picked` : null}
          />
          {takes.loading ? (
            <p className="text-sm text-ink-muted">Loading cached takes from this device…</p>
          ) : (
            <AuditionList
              models={models}
              stories={parsed.stories}
              filter={filter}
              onFilter={setFilter}
              activeChunkId={active?.chunkId ?? null}
              activeTake={active?.take ?? null}
              canReroll={!blockedReason && run.state !== "running" && run.state !== "paused"}
              onPick={onPick}
              onReroll={openReroll}
              onActivate={onActivate}
            />
          )}
        </section>

        <section className="space-y-5" aria-labelledby="s-export">
          <SectionLabel num="05" label="Export" id="s-export" />
          <ExportPanel
            video={video}
            chunks={chunks}
            byChunk={takes.byChunk}
            picks={takes.picks}
            script={deferred}
            disabled={run.state === "running" || run.state === "paused"}
          />
        </section>
        </div>
      </main>

      <RunBar
        {...generateProps}
        visible={
          chunks.length > 0 &&
          (run.state === "running" || run.state === "paused" || modeCounts.all.jobs > 0 || run.failed.length > 0)
        }
      />

      {pending && pendingCost ? (
        <ConfirmSheet
          title={pending.title}
          jobCount={pending.jobs.length}
          chars={pendingCost.chars}
          credits={pendingCost.credits}
          remaining={usage.remaining}
          remainingLoading={checkingCredits}
          onConfirm={confirm}
          onClose={closeConfirm}
        >
          {pending.mode.kind === "reroll" ? (
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-sm text-ink-muted">New takes to add</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Fewer takes"
                  onClick={() => setRerollCount((pending.mode as { count: number }).count - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-md border border-line hover:bg-surface-2"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="w-8 text-center font-mono text-lg tabular-nums">{pending.mode.count}</span>
                <button
                  type="button"
                  aria-label="More takes"
                  onClick={() => setRerollCount((pending.mode as { count: number }).count + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-md border border-line hover:bg-surface-2"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
