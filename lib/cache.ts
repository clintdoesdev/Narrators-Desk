import { createStore, del, delMany, get, getMany, keys, set, type UseStore } from "idb-keyval";
import type { Model } from "./types";

/**
 * IndexedDB persistence. Everything generated lives here so a refresh or crash
 * never re-spends credits. Stores are opened lazily (no IndexedDB during SSR).
 *
 * Retention: takes, picks and the saved script are kept for 24 hours, then
 * pruned. Takes age from when they were generated; picks and the script age
 * from their last change.
 */

export const RETENTION_MS = 24 * 60 * 60 * 1000;

export function isExpired(timestamp: number, now: number = Date.now()): boolean {
  return now - timestamp >= RETENTION_MS;
}

export function expiresAt(timestamp: number): number {
  return timestamp + RETENTION_MS;
}

export type StoredTake = {
  blob: Blob;
  seed: number;
  model: Model;
  createdAt: number;
  textHash: string;
};

export type TakeRecord = StoredTake & { chunkId: string; take: number; key: string };

let takesStore: UseStore | null = null;
let picksStore: UseStore | null = null;
let metaStore: UseStore | null = null;

const takes = () => (takesStore ??= createStore("narrators-desk-takes", "takes"));
const picks = () => (picksStore ??= createStore("narrators-desk-picks", "picks"));
const meta = () => (metaStore ??= createStore("narrators-desk-meta", "meta"));

export function takeKey(video: string, chunkId: string, take: number): string {
  return `${video}/${chunkId}/t${take}`;
}

const TAKE_KEY_RE = /^([a-z0-9-]+)\/(S\d+-\d{3})\/t(\d+)$/;

export function parseTakeKey(key: string): { video: string; chunkId: string; take: number } | null {
  const m = TAKE_KEY_RE.exec(key);
  return m ? { video: m[1], chunkId: m[2], take: Number(m[3]) } : null;
}

export async function loadTakes(video: string, now: number = Date.now()): Promise<TakeRecord[]> {
  const all = (await keys(takes())).filter((k): k is string => typeof k === "string" && k.startsWith(`${video}/`));
  if (all.length === 0) return [];
  const values = await getMany<StoredTake | undefined>(all, takes());
  const out: TakeRecord[] = [];
  all.forEach((key, i) => {
    const v = values[i];
    const parsed = parseTakeKey(key);
    if (v && parsed && parsed.video === video && !isExpired(v.createdAt, now)) {
      out.push({ ...v, chunkId: parsed.chunkId, take: parsed.take, key });
    }
  });
  return out;
}

export async function putTake(video: string, chunkId: string, take: number, value: StoredTake): Promise<void> {
  await set(takeKey(video, chunkId, take), value, takes());
}

export async function deleteTakeKeys(keyList: string[]): Promise<void> {
  if (keyList.length) await delMany(keyList, takes());
}

type StoredPicks = { picks: Record<string, number>; updatedAt: number };

export async function loadPicks(video: string, now: number = Date.now()): Promise<Record<string, number>> {
  const v = await get<StoredPicks | Record<string, number>>(video, picks());
  if (!v) return {};
  // Older builds stored the bare record; treat it as fresh.
  if (!("updatedAt" in v) || typeof v.updatedAt !== "number") return v as Record<string, number>;
  return isExpired(v.updatedAt, now) ? {} : (v as StoredPicks).picks;
}

export async function savePicks(video: string, value: Record<string, number>, now: number = Date.now()): Promise<void> {
  await set(video, { picks: value, updatedAt: now } satisfies StoredPicks, picks());
}

type StoredScript = { text: string; savedAt: number };

export async function loadScript(now: number = Date.now()): Promise<string> {
  const v = await get<StoredScript | string>("script", meta());
  if (!v) return "";
  if (typeof v === "string") return v;
  return isExpired(v.savedAt, now) ? "" : v.text;
}

export async function saveScript(text: string, now: number = Date.now()): Promise<void> {
  await set("script", { text, savedAt: now } satisfies StoredScript, meta());
}

/**
 * Deletes everything past the 24-hour window, across all videos.
 * Returns the keys of the takes it removed.
 */
export async function pruneExpired(now: number = Date.now()): Promise<string[]> {
  const takeKeys = (await keys(takes())).filter((k): k is string => typeof k === "string");
  const values = takeKeys.length ? await getMany<StoredTake | undefined>(takeKeys, takes()) : [];
  const stale = takeKeys.filter((_, i) => {
    const v = values[i];
    return !v || typeof v.createdAt !== "number" || isExpired(v.createdAt, now);
  });
  await deleteTakeKeys(stale);

  const pickKeys = await keys(picks());
  const pickValues = pickKeys.length ? await getMany<StoredPicks | Record<string, number> | undefined>(pickKeys, picks()) : [];
  const stalePicks = pickKeys.filter((_, i) => {
    const v = pickValues[i];
    return v && "updatedAt" in v && typeof v.updatedAt === "number" && isExpired(v.updatedAt, now);
  });
  if (stalePicks.length) await delMany(stalePicks, picks());

  const script = await get<StoredScript | string>("script", meta());
  if (script && typeof script !== "string" && isExpired(script.savedAt, now)) await del("script", meta());

  return stale;
}

/** Asks the browser not to evict our storage under pressure (best effort). */
export async function requestPersistence(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Unsupported or denied: data still lives for the session's 24 hours unless evicted.
  }
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return get<T>(key, meta());
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await set(key, value, meta());
}

export async function delMeta(key: string): Promise<void> {
  await del(key, meta());
}
