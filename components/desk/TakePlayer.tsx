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
      className={`flex min-w-0 items-center gap-2 rounded-lg border py-1 pr-1 pl-1 transition-colors duration-300 ${
        picked
          ? "border-brass bg-brass-dim/60"
          : active
            ? "border-line-strong bg-surface-2"
            : "border-line bg-surface"
      } ${fresh ? "" : "opacity-55"}`}
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
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors ${
          isPlaying ? "bg-brass text-brass-ink" : "bg-surface-3 text-ink hover:bg-line-strong"
        }`}
      >
        {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] text-ink-muted">
          <span className="text-ink">
            t{take}
            {fresh ? null : <span className="ml-1.5 text-warn">stale</span>}
          </span>
          <span className="tabular-nums">
            {fmt(time)} / {fmt(duration, true)}
          </span>
        </div>
        <div
          className="relative mt-1.5 h-4 cursor-pointer touch-none"
          onPointerDown={seek}
          role="presentation"
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
          <div
            className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-brass"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onPick}
        disabled={!fresh}
        aria-pressed={picked}
        aria-label={picked ? `Take ${take} is picked. Unpick` : `Pick take ${take}`}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          picked
            ? "border-brass bg-brass text-brass-ink"
            : "border-line text-ink-faint hover:border-brass hover:text-brass"
        }`}
      >
        <Check className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
