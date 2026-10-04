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
    <div className="flex flex-col items-center space-y-8 text-center">
      <div role="radiogroup" aria-label="Export contents" className="flex flex-wrap justify-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => setMode(m.id)}
            title={m.hint}
            className="chip"
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md rounded-[18px] bg-parchment px-6 py-5 text-left font-mono text-[13px] leading-[1.9] text-ink-80">
        <p className="break-all text-ink">{video}.zip</p>
        <Tree depth={0} last>
          {video}/
        </Tree>
        {mode !== "selects" ? (
          <Tree depth={1} last={false}>
            takes/ <span className="text-ink-48">{plan?.takeCount ?? 0} files</span>
          </Tree>
        ) : null}
        {mode !== "all" ? (
          <Tree depth={1} last={false}>
            selects/ <span className="text-ink-48">{plan?.selectCount ?? 0} files</span>
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
        <p className="t-caption -mt-2 text-ink-48">
          {missingPicks} {missingPicks === 1 ? "chunk has" : "chunks have"} takes but no pick yet, so{" "}
          {missingPicks === 1 ? "it won\u2019t" : "they won\u2019t"} appear in selects.
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={download}
          disabled={disabled || busy || audioFiles === 0}
          className="btn btn-primary relative overflow-hidden"
        >
          {busy ? (
            <span
              className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-300 ease-out"
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
        {disabled ? <p className="t-caption text-ink-48">Export is available once the current run finishes.</p> : null}
        {error ? (
          <p role="alert" className="t-caption text-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Tree({ children, depth, last }: { children: React.ReactNode; depth: number; last: boolean }) {
  return (
    <p className="whitespace-nowrap" style={{ paddingLeft: `${depth * 1.25}rem` }}>
      <span className="text-ink-32">{last ? "└─ " : "├─ "}</span>
      {children}
    </p>
  );
}
