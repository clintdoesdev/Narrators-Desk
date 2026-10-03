import { createStore, del, delMany, get, getMany, keys, set, type UseStore } from "idb-keyval";
import type { Model } from "./types";

/**
 * IndexedDB persistence. Everything generated lives here so a refresh or crash
 * never re-spends credits. Stores are opened lazily (no IndexedDB during SSR).
 */

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

export async function loadTakes(video: string): Promise<TakeRecord[]> {
  const all = (await keys(takes())).filter((k): k is string => typeof k === "string" && k.startsWith(`${video}/`));
  if (all.length === 0) return [];
  const values = await getMany<StoredTake | undefined>(all, takes());
  const out: TakeRecord[] = [];
  all.forEach((key, i) => {
    const v = values[i];
    const parsed = parseTakeKey(key);
    if (v && parsed && parsed.video === video) out.push({ ...v, chunkId: parsed.chunkId, take: parsed.take, key });
  });
  return out;
}

export async function putTake(video: string, chunkId: string, take: number, value: StoredTake): Promise<void> {
  await set(takeKey(video, chunkId, take), value, takes());
}

export async function deleteTakeKeys(keyList: string[]): Promise<void> {
  if (keyList.length) await delMany(keyList, takes());
}

export async function loadPicks(video: string): Promise<Record<string, number>> {
  return (await get<Record<string, number>>(video, picks())) ?? {};
}

export async function savePicks(video: string, value: Record<string, number>): Promise<void> {
  await set(video, value, picks());
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
