import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  RETENTION_MS,
  deleteTakeKeys,
  getMeta,
  isExpired,
  loadPicks,
  loadScript,
  loadTakes,
  parseTakeKey,
  pruneExpired,
  putTake,
  savePicks,
  saveScript,
  setMeta,
  takeKey,
} from "@/lib/cache";

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;

const take = (n: number, createdAt = NOW) => ({
  blob: new Blob([new Uint8Array([n])], { type: "audio/mpeg" }),
  seed: 1000 + n,
  model: "v3" as const,
  createdAt,
  textHash: "abc",
});

describe("IndexedDB cache", () => {
  it("uses the documented key format", () => {
    expect(takeKey("worst-jobs", "S1-007", 2)).toBe("worst-jobs/S1-007/t2");
    expect(parseTakeKey("worst-jobs/S1-007/t2")).toEqual({ video: "worst-jobs", chunkId: "S1-007", take: 2 });
    expect(parseTakeKey("nope")).toBeNull();
  });

  it("stores and rehydrates takes per video", async () => {
    await putTake("vid-a", "S1-001", 1, take(1));
    await putTake("vid-a", "S1-001", 2, take(2));
    await putTake("vid-b", "S1-001", 1, take(3));
    const a = await loadTakes("vid-a");
    expect(a.map((t) => [t.key, t.seed]).sort()).toEqual([
      ["vid-a/S1-001/t1", 1001],
      ["vid-a/S1-001/t2", 1002],
    ]);
    expect(a[0]).toMatchObject({ chunkId: "S1-001", model: "v3", textHash: "abc" });
    await deleteTakeKeys(["vid-a/S1-001/t1"]);
    expect((await loadTakes("vid-a")).map((t) => t.take)).toEqual([2]);
    expect(await loadTakes("vid-b")).toHaveLength(1);
  });

  it("does not match a video that is a prefix of another", async () => {
    await putTake("vid", "S1-001", 1, take(9));
    await putTake("vid-long", "S1-001", 1, take(8));
    expect((await loadTakes("vid")).map((t) => t.key)).toEqual(["vid/S1-001/t1"]);
  });

  it("stores picks and meta", async () => {
    await savePicks("vid-a", { "S1-001": 2 });
    expect(await loadPicks("vid-a")).toEqual({ "S1-001": 2 });
    expect(await loadPicks("missing")).toEqual({});
    await setMeta("script", "hello");
    expect(await getMeta("script")).toBe("hello");
  });
});

describe("24-hour retention", () => {
  it("defines the window", () => {
    expect(RETENTION_MS).toBe(24 * HOUR);
    expect(isExpired(NOW - 23 * HOUR, NOW)).toBe(false);
    expect(isExpired(NOW - 24 * HOUR, NOW)).toBe(true);
  });

  it("hides and prunes takes older than 24 hours", async () => {
    await putTake("ret", "S1-001", 1, take(1, NOW - 25 * HOUR));
    await putTake("ret", "S1-001", 2, take(2, NOW - 2 * HOUR));
    expect((await loadTakes("ret", NOW)).map((t) => t.take)).toEqual([2]);

    const removed = await pruneExpired(NOW);
    expect(removed).toContain("ret/S1-001/t1");
    expect(removed).not.toContain("ret/S1-001/t2");
    // Even an hour later, take 2 is still within its window...
    expect((await loadTakes("ret", NOW + HOUR)).map((t) => t.take)).toEqual([2]);
    // ...and it's gone once its own 24 hours are up.
    expect(await loadTakes("ret", NOW + 23 * HOUR)).toEqual([]);
  });

  it("expires picks 24 hours after the last change", async () => {
    await savePicks("ret-p", { "S1-001": 1 }, NOW - 25 * HOUR);
    expect(await loadPicks("ret-p", NOW)).toEqual({});
    await savePicks("ret-p", { "S1-001": 2 }, NOW);
    expect(await loadPicks("ret-p", NOW + 23 * HOUR)).toEqual({ "S1-001": 2 });
    await pruneExpired(NOW + 25 * HOUR);
    expect(await loadPicks("ret-p", NOW)).toEqual({});
  });

  it("expires the saved script 24 hours after the last edit", async () => {
    await saveScript("old draft", NOW - 25 * HOUR);
    expect(await loadScript(NOW)).toBe("");
    await saveScript("new draft", NOW);
    expect(await loadScript(NOW + 23 * HOUR)).toBe("new draft");
    await pruneExpired(NOW + 24 * HOUR);
    expect(await loadScript(NOW)).toBe("");
  });

  it("still reads a script saved by an older build as a plain string", async () => {
    await setMeta("script", "legacy");
    expect(await loadScript(NOW)).toBe("legacy");
  });
});
