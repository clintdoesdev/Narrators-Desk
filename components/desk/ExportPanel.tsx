"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { buildZip, planExport, type ExportMode, type ExportTake } from "@/lib/export";
import type { Chunk } from "@/lib/types";
import type { TakeView } from "./useTakes";
import { Empty } from "./ValidatePanel";

const MODES: { id: ExportMode; label: string; hint: string }[] = [
  { id: "both", label: "Both", hint: "All takes plus selects" },
  { id: "all", label: "All takes", hint: "Every fresh take" },
  { id: "selects", label: "Selects only", hint: "Just your picks" },
];

export function ExportPanel({
  video,
  chunks,
  byChunk,
  picks,
  script,
  disabled,
}: {
  video: string | null;
  chunks: Chunk[];
  byChunk: Map<string, TakeView[]>;
  picks: Record<string, number>;
  script: string;
  disabled: boolean;
}) {
  const [mode, setMode] = useState<ExportMode>("both");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const freshTakes = useMemo(() => {
    const map = new Map<string, ExportTake[]>();
    for (const [id, list] of byChunk) {
      const fresh = list.filter((t) => t.fresh).map((t) => ({ take: t.take, seed: t.seed, blob: t.blob }));
      if (fresh.length) map.set(id, fresh);
    }
    return map;
  }, [byChunk]);

  const plan = useMemo(
    () => (video ? planExport({ video, chunks, takes: freshTakes, picks, script, mode }) : null),
    [video, chunks, freshTakes, picks, script, mode],
  );

  const missingPicks = chunks.filter((c) => freshTakes.has(c.id) && picks[c.id] == null).length;
  const audioFiles = plan ? plan.takeCount + plan.selectCount : 0;
  const busy = progress !== null;

  async function download() {
    if (!video || !plan || busy) return;
    setError(null);
    setProgress(0);
    try {
      const blob = await buildZip(
        { video, chunks, takes: freshTakes, picks, script, mode },
        { onProgress: (p) => setProgress(p) },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${video}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Couldn't build the zip. The device may be low on memory; try Selects only.");
    }
    setProgress(null);
  }

  if (!video || chunks.length === 0) {
    return <Empty>Export opens up once the script has a video slug and some generated takes.</Empty>;
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="sr-only">Export contents</legend>
        <div className="grid grid-cols-3 rounded-lg bg-surface p-1 ring-1 ring-line ring-inset">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex h-11 cursor-pointer items-center justify-center rounded-md px-2 text-center text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brass ${
                mode === m.id ? "bg-surface-3 text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
              title={m.hint}
            >
              <input
                type="radio"
                name="export-mode"
                value={m.id}
                checked={mode === m.id}
                onChange={() => setMode(m.id)}
                className="sr-only"
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="font-mono text-[12px] leading-[1.9] text-ink-muted">
        <p className="break-all text-ink">{video}.zip</p>
        <Tree depth={0} last>
          {video}/
        </Tree>
        {mode !== "selects" ? (
          <Tree depth={1} last={false}>
            takes/ <span className="text-ink-faint">· {plan?.takeCount ?? 0} mp3</span>
          </Tree>
        ) : null}
        {mode !== "all" ? (
          <Tree depth={1} last={false}>
            selects/ <span className="text-ink-faint">· {plan?.selectCount ?? 0} mp3</span>
          </Tree>
        ) : null}
        <Tree depth={1} last={false}>
          manifest.csv
        </Tree>
        <Tree depth={1} last>
          script_used.txt
        </Tree>
      </div>

      {mode !== "all" && missingPicks > 0 ? (
        <p className="text-xs text-warn">
          {missingPicks} {missingPicks === 1 ? "chunk has" : "chunks have"} takes but no pick yet; {missingPicks === 1 ? "it" : "they"} won&rsquo;t appear in selects/.
        </p>
      ) : null}

      <button
        type="button"
        onClick={download}
        disabled={disabled || busy || audioFiles === 0}
        className="relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-brass text-sm font-medium text-brass-ink shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_8px_24px_-12px_rgb(196_154_88/0.6)] transition-colors hover:bg-brass-strong disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-faint disabled:shadow-none"
      >
        {busy ? (
          <span
            className="absolute inset-y-0 left-0 bg-brass-strong transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        ) : null}
        <span className="relative flex items-center gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
          {busy
            ? `Zipping… ${Math.round(progress ?? 0)}%`
            : audioFiles === 0
              ? mode === "selects"
                ? "No picks to export"
                : "No takes to export"
              : `Download ${video}.zip`}
        </span>
      </button>
      {disabled ? <p className="text-xs text-ink-faint">Export is available once the current run finishes.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Tree({ children, depth, last }: { children: React.ReactNode; depth: number; last: boolean }) {
  return (
    <p className="whitespace-nowrap" style={{ paddingLeft: `${depth * 1.25}rem` }}>
      <span className="text-line-strong">{last ? "└─ " : "├─ "}</span>
      {children}
    </p>
  );
}
