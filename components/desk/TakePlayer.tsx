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
      className={`relative flex h-12 min-w-0 items-center overflow-hidden rounded-full bg-canvas transition-shadow duration-200 ${
        picked
          ? "shadow-[inset_0_0_0_2px_var(--primary-focus)]"
          : active
            ? "shadow-[inset_0_0_0_1px_var(--ink-32)]"
            : "shadow-[inset_0_0_0_1px_var(--hairline)]"
      } ${fresh ? "" : "opacity-45"}`}
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
      <div className="pointer-events-none absolute inset-y-0 left-0 bg-primary/[0.07]" style={{ width: `${pct}%` }} aria-hidden="true" />
      <button
        type="button"
        onClick={toggle}
        onFocus={onFocus}
        aria-label={`${isPlaying ? "Pause" : "Play"} take ${take}`}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:scale-95"
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isPlaying ? "bg-primary text-white" : "bg-chip text-ink"
          }`}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" aria-hidden="true" />
          )}
        </span>
      </button>
      <div
        className="relative flex h-full min-w-0 flex-1 cursor-pointer touch-none items-center gap-2"
        onPointerDown={seek}
        role="presentation"
      >
        <span className="t-caption-strong text-ink">Take {take}</span>
        <span className="t-fine truncate text-ink-48 tabular">
          {fresh ? (isPlaying || time > 0 ? fmt(time) : fmt(duration, true)) : "Stale"}
        </span>
      </div>
      <button
        type="button"
        onClick={onPick}
        disabled={!fresh}
        aria-pressed={picked}
        aria-label={picked ? `Take ${take} is picked. Unpick` : `Pick take ${take}`}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full active:scale-95 disabled:cursor-not-allowed"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
            picked ? "bg-primary text-white" : "text-transparent shadow-[inset_0_0_0_1.5px_var(--ink-32)] hover:text-ink-32"
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
