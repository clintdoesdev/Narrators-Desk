"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import type { VoiceOption } from "@/app/api/voices/route";
import type { VoicesState } from "./useVoices";

/** "Voice: Name · Change ›" line for the dark Generate tile, opening a picker sheet. */
export function VoiceLine({ voices, disabled }: { voices: VoicesState; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className="t-body flex flex-wrap items-center justify-center gap-x-2 text-on-dark-muted">
        <span>Voice</span>
        <span className="text-on-dark">{voices.selected.name}</span>
        {voices.selected.isDefault ? <span className="t-caption">(default)</span> : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="link link-dark h-11 disabled:cursor-not-allowed disabled:text-on-dark-muted disabled:no-underline"
        >
          Change <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </p>
      {open ? <VoiceSheet voices={voices} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VoiceSheet({ voices, onClose }: { voices: VoicesState; onClose: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      audio.current?.pause();
    };
  }, [onClose]);

  const preview = (v: VoiceOption) => {
    if (!v.previewUrl) return;
    if (previewing === v.id) {
      audio.current?.pause();
      setPreviewing(null);
      return;
    }
    audio.current?.pause();
    const el = new Audio(v.previewUrl);
    el.onended = () => setPreviewing(null);
    audio.current = el;
    setPreviewing(v.id);
    void el.play().catch(() => setPreviewing(null));
  };

  const choose = (v: VoiceOption) => {
    voices.select(v);
    onClose();
  };

  const mine = voices.voices.filter((v) => v.isDefault || v.category !== "premade");
  const premade = voices.voices.filter((v) => !v.isDefault && v.category === "premade");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-title"
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-[18px] bg-canvas text-ink sm:rounded-[18px]"
      >
        <div className="px-6 pt-3 sm:pt-6">
          <span className="mx-auto mb-4 block h-1 w-9 rounded-full bg-hairline sm:hidden" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <div>
              <h2 id="voice-title" className="t-tagline">
                Choose a voice
              </h2>
              <p className="t-caption mt-1 text-ink-48">
                Switching voice marks existing takes as stale. Generating again replaces them in the new voice.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-2 -mr-2 ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-48 hover:bg-parchment hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {voices.loading && voices.voices.length === 0 ? (
            <p className="t-caption px-3 py-6 text-center text-ink-48">Loading voices…</p>
          ) : null}
          {voices.error ? (
            <div className="px-3 py-4">
              <p className="t-caption text-error">{voices.error}</p>
              <button type="button" onClick={voices.reload} className="link t-caption mt-2 h-11 gap-1.5">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
              </button>
            </div>
          ) : null}
          <Group title="Your voices" list={mine} selectedId={voices.selected.id} previewing={previewing} onPreview={preview} onChoose={choose} />
          <Group title="ElevenLabs voices" list={premade} selectedId={voices.selected.id} previewing={previewing} onPreview={preview} onChoose={choose} />
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  list,
  selectedId,
  previewing,
  onPreview,
  onChoose,
}: {
  title: string;
  list: VoiceOption[];
  selectedId: string;
  previewing: string | null;
  onPreview: (v: VoiceOption) => void;
  onChoose: (v: VoiceOption) => void;
}) {
  if (list.length === 0) return null;
  return (
    <section className="mb-3">
      <h3 className="t-caption-strong px-3 pt-2 pb-1 text-ink-48">{title}</h3>
      <ul>
        {list.map((v) => {
          const selected = v.id === selectedId;
          return (
            <li key={v.id} className="flex items-center gap-1 rounded-[12px] hover:bg-parchment">
              <button
                type="button"
                onClick={() => onPreview(v)}
                disabled={!v.previewUrl}
                aria-label={previewing === v.id ? `Stop preview of ${v.name}` : `Preview ${v.name}`}
                className="flex h-14 w-12 shrink-0 items-center justify-center disabled:opacity-0"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    previewing === v.id ? "bg-primary text-white" : "bg-chip text-ink"
                  }`}
                >
                  {previewing === v.id ? (
                    <Pause className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" aria-hidden="true" />
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onChoose(v)}
                aria-pressed={selected}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="t-body-strong block truncate">
                    {v.name}
                    {v.isDefault ? <span className="t-caption ml-2 font-normal text-ink-48">Default</span> : null}
                  </span>
                  {v.description ? <span className="t-fine block truncate text-ink-48">{v.description}</span> : null}
                </span>
                {selected ? <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
