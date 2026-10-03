import { chunkHash } from "./hash";
import type { Chunk, Model } from "./types";
import { MAX_SEED } from "./voice-config";

export const CONCURRENCY = 3;
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);
export const BACKOFF_MS: readonly number[] = [2000, 4000, 8000, 16000];
export const MAX_RETRY_AFTER_MS = 60_000;

/* ------------------------------------------------------------------ errors */

export class TtsError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = "TtsError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    // status 0 = network failure before any response: worth retrying too.
    this.retryable = status === 0 || RETRYABLE_STATUSES.has(status);
  }

  /** Errors that will fail every other job too, so the run should stop. */
  get fatal(): boolean {
    return this.status === 401 || this.status === 402 || this.code === "not_configured";
  }

  get sessionExpired(): boolean {
    return this.status === 401 && this.code === "unauthorized";
  }

  /** Plain-language message with the status for display. */
  get display(): string {
    return this.status ? `${this.detail} (status ${this.status})` : this.detail;
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === "AbortError" : (e as { name?: string })?.name === "AbortError";
}

/* ------------------------------------------------------------------ seeds */

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return Math.min(buf[0], MAX_SEED);
}

/* ------------------------------------------------------------------ retry */

/** Retry-After as delta-seconds or HTTP date → ms, capped. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.min(Math.round(Number(trimmed) * 1000), MAX_RETRY_AFTER_MS);
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.min(Math.max(0, at - now), MAX_RETRY_AFTER_MS);
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type TtsRequest = { text: string; model: Model; seed: number };

export type RetryOptions = {
  fetchFn?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
  endpoint?: string;
  now?: () => number;
  onRetry?: (attempt: number, delayMs: number, error: TtsError) => void;
};

/**
 * POSTs one take to /api/tts. Retries 429/500/502/503/504 (and network
 * failures) with 2s/4s/8s/16s backoff, honouring Retry-After. Any other
 * status fails immediately.
 */
export async function requestTake(req: TtsRequest, opts: RetryOptions = {}): Promise<Blob> {
  const fetchFn = opts.fetchFn ?? fetch;
  const sleep = opts.sleep ?? abortableSleep;
  const now = opts.now ?? Date.now;
  const endpoint = opts.endpoint ?? "/api/tts";

  for (let attempt = 0; ; attempt++) {
    let error: TtsError;
    let retryAfterMs: number | null = null;
    try {
      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: opts.signal,
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size === 0) throw new TtsError(502, "empty_audio", "ElevenLabs returned an empty file.");
        return blob.type === "audio/mpeg" ? blob : new Blob([blob], { type: "audio/mpeg" });
      }
      const body = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null;
      error = new TtsError(res.status, body?.error ?? "http_error", body?.detail ?? `Request failed.`);
      retryAfterMs = parseRetryAfter(res.headers.get("retry-after"), now());
    } catch (e) {
      if (isAbortError(e) || opts.signal?.aborted) throw e;
      error = e instanceof TtsError ? e : new TtsError(0, "network", "Network error. Check your connection.");
    }

    if (!error.retryable || attempt >= BACKOFF_MS.length) throw error;
    const delay = retryAfterMs ?? BACKOFF_MS[attempt];
    opts.onRetry?.(attempt + 1, delay, error);
    await sleep(delay, opts.signal);
  }
}

/* ------------------------------------------------------------------ planning */

export type Job = {
  key: string; // `${chunkId}/t${take}`
  chunkId: string;
  take: number;
  seed: number;
  model: Model;
  text: string;
  textHash: string;
  chars: number;
};

export type ExistingTake = { chunkId: string; take: number; textHash: string };

export type RunMode =
  | { kind: "climax" }
  | { kind: "all" }
  | { kind: "reroll"; chunkId: string; count: number }
  | { kind: "retry"; failed: { chunkId: string; take: number }[] };

export const jobKey = (chunkId: string, take: number) => `${chunkId}/t${take}`;

function freeTakeNumbers(occupied: Set<number>, count: number): number[] {
  const out: number[] = [];
  for (let n = 1; out.length < count; n++) if (!occupied.has(n)) out.push(n);
  return out;
}

function makeJob(chunk: Chunk, take: number, seed: number, hash: string): Job {
  return {
    key: jobKey(chunk.id, take),
    chunkId: chunk.id,
    take,
    seed,
    model: chunk.model,
    text: chunk.text,
    textHash: hash,
    chars: chunk.chars,
  };
}

/**
 * Builds the job list for a run. Fresh cached takes (same text hash) are
 * never regenerated; stale take slots are reused. Re-roll always adds new
 * take numbers on top of the fresh ones.
 */
export function planJobs(
  mode: RunMode,
  chunks: Chunk[],
  existing: ExistingTake[],
  seedFn: () => number = randomSeed,
): Job[] {
  const freshByChunk = new Map<string, Set<number>>();
  const hashes = new Map(chunks.map((c) => [c.id, chunkHash(c)]));
  for (const t of existing) {
    if (hashes.get(t.chunkId) !== t.textHash) continue;
    let set = freshByChunk.get(t.chunkId);
    if (!set) freshByChunk.set(t.chunkId, (set = new Set()));
    set.add(t.take);
  }
  const fresh = (id: string) => freshByChunk.get(id) ?? new Set<number>();

  const fill = (list: Chunk[]) =>
    list.flatMap((c) => {
      const have = fresh(c.id);
      const need = Math.max(0, c.takes - have.size);
      return freeTakeNumbers(have, need).map((n) => makeJob(c, n, seedFn(), hashes.get(c.id)!));
    });

  switch (mode.kind) {
    case "climax":
      return fill(chunks.filter((c) => c.climax));
    case "all":
      return fill(chunks);
    case "reroll": {
      const c = chunks.find((x) => x.id === mode.chunkId);
      if (!c || mode.count < 1) return [];
      const have = fresh(c.id);
      return freeTakeNumbers(have, mode.count).map((n) => makeJob(c, n, seedFn(), hashes.get(c.id)!));
    }
    case "retry": {
      const byId = new Map(chunks.map((c) => [c.id, c]));
      const seen = new Set<string>();
      const jobs: Job[] = [];
      for (const f of mode.failed) {
        const c = byId.get(f.chunkId);
        const k = jobKey(f.chunkId, f.take);
        if (!c || seen.has(k) || fresh(c.id).has(f.take)) continue;
        seen.add(k);
        jobs.push(makeJob(c, f.take, seedFn(), hashes.get(c.id)!));
      }
      return jobs;
    }
  }
}

export function jobsCredits(jobs: Job[], creditsPerChar: (m: Model) => number): { chars: number; credits: number } {
  let chars = 0;
  let credits = 0;
  for (const j of jobs) {
    chars += j.chars;
    credits += Math.ceil(j.chars * creditsPerChar(j.model));
  }
  return { chars, credits };
}

/* ------------------------------------------------------------------ runner */

export type JobStatus = "queued" | "generating" | "done" | "failed";

export type RunnerEvent =
  | { type: "status"; job: Job; status: JobStatus; error?: TtsError }
  | { type: "retry"; job: Job; attempt: number; delayMs: number; error: TtsError }
  | { type: "cancelled"; job: Job }
  | { type: "state"; state: RunnerState };

export type RunnerState = "idle" | "running" | "paused" | "cancelled" | "finished";

export type Execute = (
  job: Job,
  ctx: { signal: AbortSignal; onRetry: (attempt: number, delayMs: number, error: TtsError) => void },
) => Promise<void>;

/**
 * Concurrency-limited job queue with pause/resume/cancel.
 * Pause stops new jobs from starting; in-flight requests finish (they are
 * already billed). Cancel aborts in-flight requests and drops the queue.
 */
export class Runner {
  private queue: Job[];
  private readonly execute: Execute;
  private readonly concurrency: number;
  private readonly onEvent: (e: RunnerEvent) => void;
  private readonly controller = new AbortController();
  private resumeWaiters: (() => void)[] = [];
  private _state: RunnerState = "idle";

  constructor(jobs: Job[], execute: Execute, opts: { concurrency?: number; onEvent?: (e: RunnerEvent) => void } = {}) {
    this.queue = [...jobs];
    this.execute = execute;
    this.concurrency = Math.max(1, opts.concurrency ?? CONCURRENCY);
    this.onEvent = opts.onEvent ?? (() => {});
  }

  get state(): RunnerState {
    return this._state;
  }

  private setState(s: RunnerState) {
    this._state = s;
    this.onEvent({ type: "state", state: s });
  }

  async start(): Promise<void> {
    if (this._state !== "idle") return;
    for (const job of this.queue) this.onEvent({ type: "status", job, status: "queued" });
    this.setState("running");
    const workers = Array.from({ length: Math.min(this.concurrency, this.queue.length) }, () => this.worker());
    await Promise.all(workers);
    // State may have changed to "cancelled" while awaiting the workers.
    if ((this._state as RunnerState) !== "cancelled") this.setState("finished");
  }

  pause() {
    if (this._state === "running") this.setState("paused");
  }

  resume() {
    if (this._state !== "paused") return;
    this.setState("running");
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((w) => w());
  }

  cancel() {
    if (this._state === "finished" || this._state === "cancelled") return;
    const dropped = this.queue;
    this.queue = [];
    this.setState("cancelled");
    this.controller.abort();
    for (const job of dropped) this.onEvent({ type: "cancelled", job });
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((w) => w());
  }

  private async worker(): Promise<void> {
    for (;;) {
      while (this._state === "paused") await new Promise<void>((r) => this.resumeWaiters.push(r));
      if (this._state === "cancelled") return;
      const job = this.queue.shift();
      if (!job) return;
      this.onEvent({ type: "status", job, status: "generating" });
      try {
        await this.execute(job, {
          signal: this.controller.signal,
          onRetry: (attempt, delayMs, error) => this.onEvent({ type: "retry", job, attempt, delayMs, error }),
        });
        this.onEvent({ type: "status", job, status: "done" });
      } catch (e) {
        if (this.controller.signal.aborted && isAbortError(e)) {
          this.onEvent({ type: "cancelled", job });
          continue;
        }
        const err = e instanceof TtsError ? e : new TtsError(0, "client_error", e instanceof Error ? e.message : "Unknown error.");
        this.onEvent({ type: "status", job, status: "failed", error: err });
        if (err.fatal) this.cancel();
      }
    }
  }
}
