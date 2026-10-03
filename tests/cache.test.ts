import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { deleteTakeKeys, getMeta, loadPicks, loadTakes, parseTakeKey, putTake, savePicks, setMeta, takeKey } from "@/lib/cache";

const take = (n: number) => ({
  blob: new Blob([new Uint8Array([n])], { type: "audio/mpeg" }),
  seed: 1000 + n,
  model: "v3" as const,
  createdAt: n,
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
