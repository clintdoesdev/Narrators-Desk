import type { Chunk } from "./types";
import { VOICE_CONFIG } from "./voice-config";

export function creditsFor(chunk: Pick<Chunk, "chars" | "model">, takes = 1): number {
  return Math.ceil(chunk.chars * takes * VOICE_CONFIG[chunk.model].creditsPerChar);
}

export type ScriptSummary = {
  chunks: number;
  stories: number;
  v2: number;
  v3: number;
  climax: number;
  characters: number;
  /** characters × takes, summed */
  billedCharacters: number;
  credits: number;
};

export function summarize(chunks: Chunk[]): ScriptSummary {
  const stories = new Set<number>();
  let v2 = 0;
  let v3 = 0;
  let climax = 0;
  let characters = 0;
  let billedCharacters = 0;
  let credits = 0;
  for (const c of chunks) {
    stories.add(c.story);
    if (c.model === "v2") v2++;
    else v3++;
    if (c.climax) climax++;
    characters += c.chars;
    billedCharacters += c.chars * c.takes;
    credits += creditsFor(c, c.takes);
  }
  return { chunks: chunks.length, stories: stories.size, v2, v3, climax, characters, billedCharacters, credits };
}

/** True when a run would use more than `threshold` of the remaining credits. */
export function isHeavyRun(estimate: number, remaining: number | null, threshold = 0.8): boolean {
  if (remaining == null) return false;
  if (remaining <= 0) return estimate > 0;
  return estimate > remaining * threshold;
}
