import type { Model } from "./types";

/**
 * Single source of truth for model IDs and voice settings.
 * Safe to import from client code: it holds no secrets.
 */

export type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost: boolean;
  speed?: number;
};

export type ModelConfig = {
  modelId: string;
  label: string;
  voiceSettings: VoiceSettings;
  /** ElevenLabs credits charged per character on this model. */
  creditsPerChar: number;
  /** Upstream per-request character ceiling (we cap chunks lower, at 1,500). */
  maxChars: number;
};

export const VOICE_CONFIG: Record<Model, ModelConfig> = {
  v2: {
    modelId: "eleven_multilingual_v2",
    label: "Multilingual v2",
    voiceSettings: {
      stability: 0.4,
      similarity_boost: 0.78,
      style: 0.32,
      use_speaker_boost: true,
      speed: 1.05,
    },
    creditsPerChar: 1,
    maxChars: 10_000,
  },
  v3: {
    modelId: "eleven_v3",
    label: "Eleven v3",
    // v3 stability is discrete: 0.0 Creative / 0.5 Natural / 1.0 Robust.
    // No `style` and no `speed`: v3 doesn't expose them, so we don't send them.
    voiceSettings: {
      stability: 0.0,
      similarity_boost: 0.78,
      use_speaker_boost: true,
    },
    creditsPerChar: 1,
    maxChars: 5_000,
  },
};

export const OUTPUT_FORMAT = "mp3_44100_128";
export const MAX_SEED = 4_294_967_295;
