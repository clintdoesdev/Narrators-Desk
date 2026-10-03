/**
 * In-memory brute-force throttle for the login route. Per server instance, which
 * is enough for a single-user tool: after FREE_ATTEMPTS failures from one IP,
 * every further attempt is delayed, doubling up to MAX_DELAY_MS.
 */

export const FREE_ATTEMPTS = 5;
export const MAX_DELAY_MS = 30_000;
const WINDOW_MS = 15 * 60 * 1000;

type Entry = { failures: number; last: number };

const attempts = new Map<string, Entry>();

function get(ip: string, now: number): Entry | undefined {
  const e = attempts.get(ip);
  if (e && now - e.last > WINDOW_MS) {
    attempts.delete(ip);
    return undefined;
  }
  return e;
}

export function delayFor(ip: string, now = Date.now()): number {
  const e = get(ip, now);
  if (!e || e.failures < FREE_ATTEMPTS) return 0;
  return Math.min(1000 * 2 ** (e.failures - FREE_ATTEMPTS), MAX_DELAY_MS);
}

export function recordFailure(ip: string, now = Date.now()): void {
  const e = get(ip, now);
  attempts.set(ip, { failures: (e?.failures ?? 0) + 1, last: now });
  if (attempts.size > 1000) {
    for (const [k, v] of attempts) if (now - v.last > WINDOW_MS) attempts.delete(k);
  }
}

export function recordSuccess(ip: string): void {
  attempts.delete(ip);
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
