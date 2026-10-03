import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { constantTimeEqual, createSessionToken, readCookie, verifySessionToken } from "@/lib/auth";
import { FREE_ATTEMPTS, MAX_DELAY_MS, delayFor, recordFailure, recordSuccess } from "@/lib/rate-limit";

beforeEach(() => vi.stubEnv("SESSION_SECRET", "unit-test-secret-unit-test-secret"));
afterEach(() => vi.unstubAllEnvs());

describe("session tokens", () => {
  it("round-trips", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await createSessionToken();
    vi.stubEnv("SESSION_SECRET", "a-completely-different-secret!!");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("rejects empty and garbage tokens", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("abc.def.ghi")).toBe(false);
  });
});

describe("constantTimeEqual", () => {
  it("compares strings", async () => {
    expect(await constantTimeEqual("abc", "abc")).toBe(true);
    expect(await constantTimeEqual("abc", "abd")).toBe(false);
    expect(await constantTimeEqual("abc", "abcd")).toBe(false);
    expect(await constantTimeEqual("", "")).toBe(true);
  });
});

describe("readCookie", () => {
  it("finds a named cookie", () => {
    expect(readCookie("a=1; nd_session=xyz; b=2", "nd_session")).toBe("xyz");
    expect(readCookie(null, "nd_session")).toBeUndefined();
  });
});

describe("login throttle", () => {
  it("delays after five failures and resets on success", () => {
    const ip = "203.0.113.9";
    const t = 1_000_000;
    for (let i = 0; i < FREE_ATTEMPTS; i++) {
      expect(delayFor(ip, t)).toBe(0);
      recordFailure(ip, t);
    }
    expect(delayFor(ip, t)).toBe(1000);
    recordFailure(ip, t);
    expect(delayFor(ip, t)).toBe(2000);
    for (let i = 0; i < 20; i++) recordFailure(ip, t);
    expect(delayFor(ip, t)).toBe(MAX_DELAY_MS);
    recordSuccess(ip);
    expect(delayFor(ip, t)).toBe(0);
  });

  it("forgets failures after the window", () => {
    const ip = "203.0.113.10";
    for (let i = 0; i < 8; i++) recordFailure(ip, 0);
    expect(delayFor(ip, 16 * 60 * 1000)).toBe(0);
  });
});
