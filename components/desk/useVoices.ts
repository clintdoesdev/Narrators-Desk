"use client";

import { useCallback, useEffect, useState } from "react";
import type { VoiceOption } from "@/app/api/voices/route";

const STORAGE_KEY = "nd.voice";

export type VoicesState = {
  voices: VoiceOption[];
  loading: boolean;
  error: string | null;
  selected: VoiceOption;
  select: (voice: VoiceOption) => void;
  reload: () => void;
};

const FALLBACK: VoiceOption = {
  id: "default",
  name: "Your voice",
  category: null,
  description: null,
  previewUrl: null,
  isDefault: true,
};

function readStored(): VoiceOption | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as VoiceOption) : null;
  } catch {
    return null;
  }
}

export function useVoices(): VoicesState {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VoiceOption>(FALLBACK);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voices", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as { voices?: VoiceOption[]; detail?: string } | null;
      if (!res.ok || !body?.voices) {
        setError(`${body?.detail ?? "Couldn't load voices."} (status ${res.status})`);
        return;
      }
      setVoices(body.voices);
      setError(null);
      const stored = readStored();
      const match = stored && body.voices.find((v) => v.id === stored.id);
      setSelected(match ?? body.voices[0] ?? FALLBACK);
    } catch {
      setError("Can't reach the server to load voices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Restore the last choice immediately so takes hash against the right voice.
    const stored = readStored();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setSelected(stored);
    void load();
  }, [load]);

  const select = useCallback((voice: VoiceOption) => {
    setSelected(voice);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(voice));
    } catch {
      // Storage blocked: the choice lasts for this visit.
    }
  }, []);

  return { voices, loading, error, selected, select, reload: () => void load() };
}
