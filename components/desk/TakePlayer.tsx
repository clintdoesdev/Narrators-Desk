"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";

/** Registry so keyboard shortcuts can toggle a take; one take plays at a time. */
const players = new Map<string, { toggle: () => void }>();
let playing: HTMLAudioElement | null = null;

export function togglePlayer(key: string): boolean {
  const p = players.get(key);
  if (!p) return false;
  p.toggle();
  return true;
}

function fmt(s: number, roundUp = false): string {
  if (!Number.isFinite(s)) return "0:00";
  if (roundUp) s = Math.ceil(s);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function TakePlayer({
  playerKey,
  take,
  blob,
  seed,
  fresh,
  picked,
  active,
  onPick,
  onFocus,
}: {
  playerKey: string;
  take: number;
  blob: Blob;
  seed: number;
  fresh: boolean;
  picked: boolean;
  active: boolean;
  onPick: () => void;
  onFocus: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const url = URL.createObjectURL(blob);
    // Native listeners: metadata can load before React's media props attach.
    const onMeta = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.src = url;
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.pause();
      el.removeAttribute("src");
      el.load();
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      if (playing && playing !== el) playing.pause();
      playing = el;
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  };

  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    players.set(playerKey, { toggle: () => toggleRef.current() });
    return () => {
      players.delete(playerKey);
    };
  }, [playerKey]);

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = Math.min(duration, Math.max(0, ((e.clientX - rect.left) / rect.width) * duration));
    setTime(el.currentTime);
  };

  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div
      className={`group relative flex h-12 min-w-0 items-center overflow-hidden rounded-lg ring-1 transition-[background-color,box-shadow] duration-300 ring-inset ${
        picked
          ? "bg-brass-dim/70 ring-brass/80"
          : active
            ? "bg-surface-2 ring-line-strong"
            : "bg-surface ring-line hover:ring-line-strong"
      } ${fresh ? "" : "opacity-50"}`}
      title={`Take ${take} · seed ${seed}${fresh ? "" : " · stale (script changed)"}`}
    >
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
      />
      <button
        type="button"
        onClick={toggle}
        onFocus={onFocus}
        aria-label={`${isPlaying ? "Pause" : "Play"} take ${take}`}
        className="flex h-12 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isPlaying ? "bg-brass text-brass-ink" : "bg-surface-3 text-ink group-hover:bg-line-strong"
          }`}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-px" aria-hidden="true" />
          )}
        </span>
      </button>
      <div className="flex min-w-0 flex-1 items-baseline gap-2 pr-1 font-mono text-[11px]">
        <span className={picked ? "text-brass-strong" : "text-ink"}>t{take}</span>
        <span className="truncate text-ink-faint tabular">
          {fresh ? (isPlaying || time > 0 ? fmt(time) : fmt(duration, true)) : "stale"}
        </span>
      </div>
      <button
        type="button"
        onClick={onPick}
        disabled={!fresh}
        aria-pressed={picked}
        aria-label={picked ? `Take ${take} is picked. Unpick` : `Pick take ${take}`}
        className="flex h-12 w-11 shrink-0 items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
            picked
              ? "border-brass bg-brass text-brass-ink"
              : "border-line-strong text-transparent group-hover:text-ink-faint hover:border-brass hover:!text-brass"
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        </span>
      </button>
      <div
        className="absolute inset-x-0 bottom-0 h-[2px] cursor-pointer touch-none"
        onPointerDown={seek}
        role="presentation"
      >
        <div className="h-full bg-brass transition-[width] duration-150 ease-linear" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
