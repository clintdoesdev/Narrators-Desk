import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { POST as tts } from "@/app/api/tts/route";
import { GET as usage } from "@/app/api/usage/route";
import { POST as login } from "@/app/api/login/route";

const KEY = "sk_test_supersecretkey_1234567890";
const VOICE = "voice_ABCDEFGHIJ123";

let cookie = "";

beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "test-secret-test-secret-test-secret");
  vi.stubEnv("ELEVENLABS_API_KEY", KEY);
  vi.stubEnv("VOICE_ID", VOICE);
  vi.stubEnv("APP_PASSWORD", "correct horse");
  cookie = `${SESSION_COOKIE}=${await createSessionToken()}`;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ttsReq(body: unknown, withCookie = true) {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json", ...(withCookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/tts", () => {
  it("rejects requests without a valid session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await tts(ttsReq({ text: "Hi", model: "v2", seed: 1 }, false));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a forged cookie", async () => {
    const req = new Request("http://localhost/api/tts", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJvd25lciJ9.bad` },
      body: "{}",
    });
    expect((await tts(req)).status).toBe(401);
  });

  it.each([
    [{ text: "", model: "v2", seed: 1 }],
    [{ text: "x".repeat(1501), model: "v2", seed: 1 }],
    [{ text: "Hi", model: "v4", seed: 1 }],
    [{ text: "Hi", model: "v3", seed: -1 }],
    [{ text: "Hi", model: "v3", seed: 4294967296 }],
    [{ text: "Hi", model: "v3", seed: 1.5 }],
  ])("validates input %#", async (body) => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await tts(ttsReq(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "bad_request" });
  });

  it("calls ElevenLabs with the v2 config and streams MP3 back", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await tts(ttsReq({ text: "Hello there.", model: "v2", seed: 4294967295 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`);
    const headers = init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe(KEY);
    expect(headers.Accept).toBe("audio/mpeg");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "Hello there.",
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.78, style: 0.32, use_speaker_boost: true, speed: 1.05 },
      seed: 4294967295,
    });
  });

  it("sends v3 without style or speed", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([9])));
    vi.stubGlobal("fetch", fetchMock);
    await tts(ttsReq({ text: "[sighs] Fine.", model: "v3", seed: 0 }));
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const sent = JSON.parse(init.body as string);
    expect(sent.model_id).toBe("eleven_v3");
    expect(sent.voice_settings).toEqual({ stability: 0, similarity_boost: 0.78, use_speaker_boost: true });
  });

  it("forwards upstream status with a safe JSON body and Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: { status: "too_many_concurrent_requests", message: `Busy for key ${KEY}` } }), {
            status: 429,
            headers: { "retry-after": "7", "set-cookie": "upstream=1" },
          }),
      ),
    );
    const res = await tts(ttsReq({ text: "Hi", model: "v2", seed: 1 }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(res.headers.get("set-cookie")).toBeNull();
    const body = await res.json();
    expect(body.error).toBe("elevenlabs_error");
    expect(body.detail).toContain("too_many_concurrent_requests");
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it("marks an upstream 401 distinctly from a session 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not json", { status: 401 })));
    const res = await tts(ttsReq({ text: "Hi", model: "v2", seed: 1 }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "elevenlabs_unauthorized", detail: "ElevenLabs rejected the API key." });
  });

  it("returns 502 when ElevenLabs is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const res = await tts(ttsReq({ text: "Hi", model: "v2", seed: 1 }));
    expect(res.status).toBe(502);
  });

  it("returns 500 when env is missing", async () => {
    vi.stubEnv("VOICE_ID", "");
    const res = await tts(ttsReq({ text: "Hi", model: "v2", seed: 1 }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "not_configured" });
  });
});

describe("GET /api/usage", () => {
  it("returns only the whitelisted fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              character_count: 1200,
              character_limit: 100000,
              next_character_count_reset_unix: 1790000000,
              tier: "creator",
              voice_limit: 30,
              can_extend_character_limit: true,
              invoices: [{ secret: true }],
            }),
          ),
      ),
    );
    const res = await usage(new Request("http://localhost/api/usage", { headers: { cookie } }));
    expect(await res.json()).toEqual({
      character_count: 1200,
      character_limit: 100000,
      next_character_count_reset_unix: 1790000000,
      tier: "creator",
    });
  });

  it("requires a session", async () => {
    const res = await usage(new Request("http://localhost/api/usage"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/login", () => {
  const req = (password: string, ip = "10.0.0.1") =>
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ password }),
    });

  it("sets a hardened session cookie on the right password", async () => {
    const res = await login(req("correct horse"));
    expect(res.status).toBe(200);
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toContain(`${SESSION_COOKIE}=`);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/Secure/i);
    expect(set).toMatch(/SameSite=strict/i);
    expect(set).toMatch(/Max-Age=2592000/);
  });

  it("rejects the wrong password", async () => {
    const res = await login(req("nope", "10.0.0.2"));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
