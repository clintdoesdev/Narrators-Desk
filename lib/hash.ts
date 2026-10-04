import type { Model } from "./types";

/** cyrb53: fast, sync 53-bit string hash. Plenty for cache invalidation. */
export function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const DEFAULT_VOICE = "default";

/**
 * Hash of what actually gets sent: changing text, model or voice makes old
 * takes stale. The default voice hashes exactly as older builds did, so
 * existing caches stay fresh.
 */
export function chunkHash(chunk: { model: Model; text: string }, voice: string = DEFAULT_VOICE): string {
  const base = `${chunk.model}\u0000${chunk.text}`;
  return cyrb53(voice === DEFAULT_VOICE ? base : `${base}\u0000${voice}`);
}
