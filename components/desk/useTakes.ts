"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteTakeKeys, loadPicks, loadTakes, savePicks, type TakeRecord } from "@/lib/cache";
import { chunkHash } from "@/lib/hash";
import type { Chunk } from "@/lib/types";

export type TakeView = TakeRecord & { fresh: boolean };

export type TakesState = {
  loading: boolean;
  error: string | null;
  /** chunkId → takes sorted by take number (fresh and stale) */
  byChunk: Map<string, TakeView[]>;
  /** chunkId → picked take number (only when that take exists and is fresh) */
  picks: Record<string, number>;
  addTake: (rec: TakeRecord) => void;
  setPick: (chunkId: string, take: number | null) => void;
  staleKeys: string[];
  clearStale: () => Promise<void>;
};

export function useTakes(video: string | null, chunks: Chunk[]): TakesState {
  const [records, setRecords] = useState<TakeRecord[]>([]);
  const [rawPicks, setRawPicks] = useState<Record<string, number>>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    Promise.all([loadTakes(video), loadPicks(video)])
      .then(([recs, picks]) => {
        if (cancelled) return;
        setRecords(recs);
        setRawPicks(picks);
        setError(null);
        setLoadedFor(video);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't open this device's audio cache (IndexedDB). Private browsing can block it.");
        setLoadedFor(video);
      });
    return () => {
      cancelled = true;
    };
  }, [video]);

  const current = useMemo(() => (loadedFor === video && video ? records : []), [loadedFor, video, records]);

  const hashes = useMemo(() => new Map(chunks.map((c) => [c.id, chunkHash(c)])), [chunks]);

  const byChunk = useMemo(() => {
    const map = new Map<string, TakeView[]>();
    for (const r of current) {
      const h = hashes.get(r.chunkId);
      if (h === undefined) continue; // orphaned: chunk no longer in script
      const list = map.get(r.chunkId) ?? [];
      list.push({ ...r, fresh: r.textHash === h });
      map.set(r.chunkId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.take - b.take);
    return map;
  }, [current, hashes]);

  const picks = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [chunkId, take] of Object.entries(loadedFor === video ? rawPicks : {})) {
      if (byChunk.get(chunkId)?.some((t) => t.take === take && t.fresh)) out[chunkId] = take;
    }
    return out;
  }, [rawPicks, byChunk, loadedFor, video]);

  const staleKeys = useMemo(
    () => current.filter((r) => hashes.get(r.chunkId) !== r.textHash).map((r) => r.key),
    [current, hashes],
  );

  const addTake = useCallback((rec: TakeRecord) => {
    setRecords((prev) => [...prev.filter((r) => r.key !== rec.key), rec]);
  }, []);

  const setPick = useCallback(
    (chunkId: string, take: number | null) => {
      if (!video) return;
      setRawPicks((prev) => {
        const next = { ...prev };
        if (take == null || prev[chunkId] === take) delete next[chunkId];
        else next[chunkId] = take;
        savePicks(video, next).catch(() => {});
        return next;
      });
    },
    [video],
  );

  const clearStale = useCallback(async () => {
    const keys = new Set(staleKeys);
    await deleteTakeKeys([...keys]);
    setRecords((prev) => prev.filter((r) => !keys.has(r.key)));
  }, [staleKeys]);

  return {
    loading: Boolean(video) && loadedFor !== video,
    error,
    byChunk,
    picks,
    addTake,
    setPick,
    staleKeys,
    clearStale,
  };
}
