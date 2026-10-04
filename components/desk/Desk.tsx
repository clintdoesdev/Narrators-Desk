"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { SectionLabel } from "@/components/SectionLabel";
import { loadScript, saveScript } from "@/lib/cache";
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
import { Empty, ValidatePanel } from "./ValidatePanel";
import { useOnline } from "./useOnline";
import { useRun } from "./useRun";
import { useTakes } from "./useTakes";
import { useUsage } from "./useUsage";

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
    loadScript()
      .then((s) => {
        if (s) setScript(s);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => saveScript(script).catch(() => {}), 400);
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

  const runActive = run.state === "running" || run.state === "paused";
  const navAction = runActive ? (
    <span className="t-caption text-ink-48 tabular">
      {run.progress.done} of {run.progress.total} takes
    </span>
  ) : modeCounts.all.jobs > 0 ? (
    <button type="button" onClick={generateProps.onAll} disabled={Boolean(blockedReason)} className="btn btn-primary btn-sm">
      Generate all
    </button>
  ) : null;

  return (
    <div className="min-h-dvh">
      <Header video={video} credits={usage.view} online={online} action={navAction} />
      <main className="pb-24 md:pb-0">
        <Tile id="script" tone="light">
          <SectionLabel
            num="01"
            label="Script"
            id="s-script"
            aside={video ? <span className="font-mono lg:hidden">{video}</span> : null}
          />
          <div className="mt-8">
            {hydrated ? (
              <ScriptEditor ref={editor} value={script} onChange={setScript} onLoadExample={() => setScript(EXAMPLE_SCRIPT)} />
            ) : (
              <div className="h-56 animate-pulse rounded-[18px] bg-parchment" aria-label="Loading saved script" />
            )}
          </div>
        </Tile>

        <Tile id="validate" tone="parchment">
          <SectionLabel num="02" label="Validate" id="s-validate" center />
          <div className="mt-10">
            <ValidatePanel
              summary={summary}
              errors={parsed.errors}
              warnings={parsed.warnings}
              remaining={usage.remaining}
              hasScript={script.trim().length > 0}
              onJump={jump}
            />
          </div>
        </Tile>

        <Tile id="generate" tone="dark">
          <SectionLabel num="03" label="Generate" id="s-generate" dark center />
          {takes.error ? <p className="t-caption mt-4 text-center text-error-on-dark">{takes.error}</p> : null}
          {usage.view.state === "error" ? (
            <p className="t-caption mt-4 text-center text-on-dark-muted">
              <span className="text-error-on-dark">Credits unavailable.</span> {usage.view.message}
            </p>
          ) : null}
          <div className="mt-12">
            <GeneratePanel {...generateProps} />
          </div>
        </Tile>

        <Tile id="audition" tone="parchment" wide>
          <SectionLabel
            num="04"
            label="Audition"
            id="s-audition"
            center
            aside={chunks.length ? `${Object.keys(takes.picks).length} of ${chunks.length} chunks picked` : null}
          />
          <div className="mt-10">
            {takes.loading ? (
              <Empty>Loading cached takes from this device…</Empty>
            ) : (
              <AuditionList
                models={models}
                stories={parsed.stories}
                filter={filter}
                onFilter={setFilter}
                activeChunkId={active?.chunkId ?? null}
                activeTake={active?.take ?? null}
                canReroll={!blockedReason && !runActive}
                onPick={onPick}
                onReroll={openReroll}
                onActivate={onActivate}
              />
            )}
          </div>
        </Tile>

        <Tile id="export" tone="light">
          <SectionLabel num="05" label="Export" id="s-export" center />
          <div className="mt-10">
            <ExportPanel
              video={video}
              chunks={chunks}
              byChunk={takes.byChunk}
              picks={takes.picks}
              script={deferred}
              disabled={runActive}
            />
          </div>
        </Tile>
      </main>

      <footer className="bg-parchment">
        <div className="mx-auto max-w-[980px] border-t border-hairline px-5 py-6">
          <p className="t-fine text-ink-48">
            Narrator&rsquo;s Desk. Audio is cached on this device only. Nothing leaves it except text sent to ElevenLabs.
          </p>
        </div>
      </footer>

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
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="t-body text-ink">New takes to add</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Fewer takes"
                  onClick={() => setRerollCount((pending.mode as { count: number }).count - 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-chip text-ink transition-transform active:scale-95"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="t-tagline w-8 text-center tabular">{pending.mode.count}</span>
                <button
                  type="button"
                  aria-label="More takes"
                  onClick={() => setRerollCount((pending.mode as { count: number }).count + 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-chip text-ink transition-transform active:scale-95"
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

/** Full-bleed section. The color change between tiles is the divider. */
function Tile({
  id,
  tone,
  wide,
  children,
}: {
  id: string;
  tone: "light" | "parchment" | "dark";
  wide?: boolean;
  children: React.ReactNode;
}) {
  const bg = tone === "dark" ? "bg-tile text-on-dark" : tone === "parchment" ? "bg-parchment" : "bg-canvas";
  return (
    <section id={id} aria-labelledby={`s-${id}`} className={`${bg} scroll-mt-[52px]`}>
      <div className={`mx-auto px-5 py-16 md:py-20 ${wide ? "max-w-[1080px]" : "max-w-[980px]"}`}>{children}</div>
    </section>
  );
}
