import { describe, expect, it, vi } from "vitest";
import { chunkHash } from "@/lib/hash";
import { parseScript } from "@/lib/parser";
import {
  BACKOFF_MS,
  Runner,
  TtsError,
  parseRetryAfter,
  planJobs,
  randomSeed,
  requestTake,
  type Job,
  type RunnerEvent,
} from "@/lib/runner";

const audio = () => new Response(new Blob([new Uint8Array([0xff, 0xfb, 1])], { type: "audio/mpeg" }), { status: 200 });
const fail = (status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: "elevenlabs_error", detail: `boom ${status}` }), { status, headers });

function harness(responses: (Response | Error)[]) {
  const fetchFn = vi.fn(async () => {
    const r = responses.shift();
    if (!r) throw new Error("no more responses");
    if (r instanceof Error) throw r;
    return r;
  });
  const delays: number[] = [];
  const sleep = vi.fn(async (ms: number) => {
    delays.push(ms);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, sleep, delays, calls: fetchFn };
}

const req = { text: "Hello.", model: "v2" as const, seed: 42 };

describe("requestTake", () => {
  it("returns the MP3 blob on success and posts the request", async () => {
    const h = harness([audio()]);
    const blob = await requestTake(req, h);
    expect(blob.size).toBe(3);
    expect(blob.type).toBe("audio/mpeg");
    const [url, init] = h.calls.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tts");
    expect(JSON.parse(init.body as string)).toEqual(req);
  });

  it.each([429, 500, 502, 503, 504])("retries %i with 2/4/8/16s backoff then gives up", async (status) => {
    const h = harness([fail(status), fail(status), fail(status), fail(status), fail(status)]);
    const err = await requestTake(req, h).catch((e) => e);
    expect(err).toBeInstanceOf(TtsError);
    expect(err.status).toBe(status);
    expect(h.delays).toEqual([2000, 4000, 8000, 16000]);
    expect(h.calls).toHaveBeenCalledTimes(5);
  });

  it("recovers after transient failures", async () => {
    const h = harness([fail(503), fail(429), audio()]);
    const onRetry = vi.fn();
    const blob = await requestTake(req, { ...h, onRetry });
    expect(blob.size).toBe(3);
    expect(h.delays).toEqual([2000, 4000]);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 2000, expect.any(TtsError));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 4000, expect.any(TtsError));
  });

  it("respects Retry-After seconds", async () => {
    const h = harness([fail(429, { "retry-after": "5" }), audio()]);
    await requestTake(req, h);
    expect(h.delays).toEqual([5000]);
  });

  it("respects Retry-After as an HTTP date", async () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const h = harness([fail(503, { "retry-after": "Thu, 01 Jan 2026 00:00:03 GMT" }), audio()]);
    await requestTake(req, { ...h, now: () => now });
    expect(h.delays).toEqual([3000]);
  });

  it.each([400, 401, 402, 403, 404, 422])("fails %i immediately without retry", async (status) => {
    const h = harness([fail(status)]);
    const err = await requestTake(req, h).catch((e) => e);
    expect(err).toBeInstanceOf(TtsError);
    expect(err.status).toBe(status);
    expect(err.detail).toBe(`boom ${status}`);
    expect(h.calls).toHaveBeenCalledTimes(1);
    expect(h.delays).toEqual([]);
  });

  it("retries network errors", async () => {
    const h = harness([new TypeError("Failed to fetch"), audio()]);
    await requestTake(req, h);
    expect(h.delays).toEqual([BACKOFF_MS[0]]);
  });

  it("stops on abort without retrying", async () => {
    const controller = new AbortController();
    controller.abort();
    const h = harness([new DOMException("Aborted", "AbortError")]);
    const err = await requestTake(req, { ...h, signal: controller.signal }).catch((e) => e);
    expect(err.name).toBe("AbortError");
    expect(h.delays).toEqual([]);
  });

  it("treats an empty body as a retryable failure", async () => {
    const h = harness([new Response(new Blob([]), { status: 200 }), audio()]);
    const blob = await requestTake(req, h);
    expect(blob.size).toBe(3);
    expect(h.delays).toEqual([2000]);
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds, dates, and caps", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("1.5")).toBe(1500);
    expect(parseRetryAfter("9999")).toBe(60000);
    expect(parseRetryAfter("garbage")).toBeNull();
  });
});

describe("randomSeed", () => {
  it("is a 32-bit unsigned integer", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(4294967295);
    }
  });
});

const script = `@@VIDEO: plan-test
@@TAKES_V2: 2
@@TAKES_V3: 3
== S1: A ==
[AUDIO — v2]
One.

Two.
[AUDIO — v3 — CLIMAX]
Three.`;

describe("planJobs", () => {
  const { chunks } = parseScript(script);
  let n = 0;
  const seed = () => ++n;

  it("generate all builds chunk × takes jobs", () => {
    const jobs = planJobs({ kind: "all" }, chunks, [], seed);
    expect(jobs.map((j) => j.key)).toEqual([
      "S1-001/t1",
      "S1-001/t2",
      "S1-002/t1",
      "S1-002/t2",
      "S1-003/t1",
      "S1-003/t2",
      "S1-003/t3",
    ]);
    expect(new Set(jobs.map((j) => j.seed)).size).toBe(jobs.length);
  });

  it("climax only", () => {
    const jobs = planJobs({ kind: "climax" }, chunks, [], seed);
    expect(jobs.map((j) => j.key)).toEqual(["S1-003/t1", "S1-003/t2", "S1-003/t3"]);
    expect(jobs[0]).toMatchObject({ model: "v3", text: "Three.", chars: 6, textHash: chunkHash(chunks[2]) });
  });

  it("skips fresh cached takes and reuses stale slots", () => {
    const fresh = { chunkId: "S1-001", take: 1, textHash: chunkHash(chunks[0]) };
    const stale = { chunkId: "S1-002", take: 1, textHash: "old" };
    const jobs = planJobs({ kind: "all" }, chunks, [fresh, stale], seed);
    expect(jobs.map((j) => j.key)).toEqual([
      "S1-001/t2",
      "S1-002/t1",
      "S1-002/t2",
      "S1-003/t1",
      "S1-003/t2",
      "S1-003/t3",
    ]);
  });

  it("returns nothing when everything is cached", () => {
    const existing = planJobs({ kind: "all" }, chunks, [], seed).map((j) => ({ chunkId: j.chunkId, take: j.take, textHash: j.textHash }));
    expect(planJobs({ kind: "all" }, chunks, existing, seed)).toEqual([]);
  });

  it("re-roll adds new take numbers without replacing fresh ones", () => {
    const h = chunkHash(chunks[2]);
    const existing = [1, 2, 3].map((take) => ({ chunkId: "S1-003", take, textHash: h }));
    const jobs = planJobs({ kind: "reroll", chunkId: "S1-003", count: 2 }, chunks, existing, seed);
    expect(jobs.map((j) => j.key)).toEqual(["S1-003/t4", "S1-003/t5"]);
  });

  it("retry failed rebuilds only still-missing jobs", () => {
    const h = chunkHash(chunks[0]);
    const jobs = planJobs(
      {
        kind: "retry",
        failed: [
          { chunkId: "S1-001", take: 2 },
          { chunkId: "S1-001", take: 2 },
          { chunkId: "S1-001", take: 1 },
          { chunkId: "S9-001", take: 1 },
        ],
      },
      chunks,
      [{ chunkId: "S1-001", take: 1, textHash: h }],
      seed,
    );
    expect(jobs.map((j) => j.key)).toEqual(["S1-001/t2"]);
  });
});

function makeJobs(count: number): Job[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `S1-00${i + 1}/t1`,
    chunkId: `S1-00${i + 1}`,
    take: 1,
    seed: i,
    model: "v2" as const,
    text: "x",
    textHash: "h",
    chars: 1,
  }));
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Runner", () => {
  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const runner = new Runner(
      makeJobs(9),
      async () => {
        active++;
        peak = Math.max(peak, active);
        await flush();
        active--;
      },
      { concurrency: 3 },
    );
    await runner.start();
    expect(peak).toBe(3);
    expect(runner.state).toBe("finished");
  });

  it("emits queued → generating → done/failed", async () => {
    const events: RunnerEvent[] = [];
    const runner = new Runner(
      makeJobs(2),
      async (job) => {
        if (job.chunkId === "S1-002") throw new TtsError(422, "elevenlabs_error", "bad");
      },
      { onEvent: (e) => events.push(e) },
    );
    await runner.start();
    const statuses = events.filter((e) => e.type === "status").map((e) => (e.type === "status" ? `${e.job.chunkId}:${e.status}` : ""));
    expect(statuses).toEqual([
      "S1-001:queued",
      "S1-002:queued",
      "S1-001:generating",
      "S1-002:generating",
      "S1-001:done",
      "S1-002:failed",
    ]);
  });

  it("pause stops new jobs; resume continues", async () => {
    const gates = makeJobs(4).map(() => deferred());
    const started: string[] = [];
    const runner = new Runner(
      makeJobs(4),
      async (job) => {
        started.push(job.chunkId);
        await gates[started.length - 1].promise;
      },
      { concurrency: 1 },
    );
    const done = runner.start();
    await flush();
    expect(started).toEqual(["S1-001"]);
    runner.pause();
    gates[0].resolve();
    await flush();
    expect(started).toEqual(["S1-001"]);
    expect(runner.state).toBe("paused");
    runner.resume();
    await flush();
    expect(started).toEqual(["S1-001", "S1-002"]);
    gates.forEach((g) => g.resolve());
    await done;
    expect(started).toHaveLength(4);
  });

  it("cancel aborts in-flight work and drops the queue", async () => {
    const events: RunnerEvent[] = [];
    let sawAbort = false;
    const runner = new Runner(
      makeJobs(5),
      (_job, { signal }) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener("abort", () => {
            sawAbort = true;
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
      { concurrency: 2, onEvent: (e) => events.push(e) },
    );
    const done = runner.start();
    await flush();
    runner.cancel();
    await done;
    expect(sawAbort).toBe(true);
    expect(runner.state).toBe("cancelled");
    expect(events.filter((e) => e.type === "cancelled")).toHaveLength(5);
    expect(events.some((e) => e.type === "status" && e.status === "failed")).toBe(false);
  });

  it("stops the run on a fatal error", async () => {
    let calls = 0;
    const runner = new Runner(
      makeJobs(6),
      async () => {
        calls++;
        throw new TtsError(401, "elevenlabs_unauthorized", "bad key");
      },
      { concurrency: 1 },
    );
    await runner.start();
    expect(calls).toBe(1);
    expect(runner.state).toBe("cancelled");
  });

  it("works end to end with requestTake and a mocked fetch", async () => {
    const h = harness([fail(503), audio(), audio(), audio()]);
    const stored: string[] = [];
    const retries: number[] = [];
    const runner = new Runner(
      makeJobs(3),
      async (job, { signal, onRetry }) => {
        await requestTake({ text: job.text, model: job.model, seed: job.seed }, { ...h, signal, onRetry });
        stored.push(job.key);
      },
      { concurrency: 1, onEvent: (e) => e.type === "retry" && retries.push(e.delayMs) },
    );
    await runner.start();
    expect(stored).toHaveLength(3);
    expect(retries).toEqual([2000]);
  });
});
