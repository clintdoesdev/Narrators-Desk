import "server-only";

/**
 * Server-only ElevenLabs helpers. The API key and voice ID never leave this
 * module: they are read from env per request and are never logged or echoed.
 */

export const ELEVEN_BASE = "https://api.elevenlabs.io";

export type ElevenEnv = { apiKey: string; voiceId: string };

export function readElevenEnv(): ElevenEnv | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.VOICE_ID;
  if (!apiKey || !voiceId) return null;
  return { apiKey, voiceId };
}

/**
 * Turns an upstream error body into a short, safe message. Only the
 * human-readable `message`/`detail` string is kept; anything that echoes the
 * key or voice ID is redacted, and the result is length-capped.
 */
export function safeUpstreamDetail(raw: string, env: ElevenEnv | null, status: number): string {
  let message = "";
  try {
    const body = JSON.parse(raw) as unknown;
    message = extractMessage(body);
  } catch {
    message = "";
  }
  if (!message) message = defaultMessage(status);
  if (env) {
    for (const secret of [env.apiKey, env.voiceId]) {
      if (secret) message = message.split(secret).join("[redacted]");
    }
  }
  message = message.replace(/\s+/g, " ").trim();
  return message.length > 300 ? `${message.slice(0, 297)}...` : message;
}

function extractMessage(body: unknown): string {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";
  const obj = body as Record<string, unknown>;
  const detail = obj.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (Array.isArray(detail)) {
      const first = detail[0] as Record<string, unknown> | undefined;
      if (first && typeof first.msg === "string") return first.msg;
    }
    const status = typeof d.status === "string" ? d.status : "";
    const msg = typeof d.message === "string" ? d.message : "";
    if (msg) return status ? `${msg} (${status})` : msg;
  }
  if (typeof obj.message === "string") return obj.message;
  return "";
}

export function defaultMessage(status: number): string {
  if (status === 401) return "ElevenLabs rejected the API key.";
  if (status === 402) return "ElevenLabs says the account is out of credits or needs payment.";
  if (status === 403) return "ElevenLabs refused the request for this account.";
  if (status === 404) return "ElevenLabs couldn't find that voice.";
  if (status === 422) return "ElevenLabs couldn't process the request (invalid parameters).";
  if (status === 429) return "ElevenLabs is rate limiting requests. Slow down and retry.";
  if (status >= 500) return "ElevenLabs had a server error.";
  return `ElevenLabs returned status ${status}.`;
}

/** Voice IDs are short alphanumeric strings. "default" means the env VOICE_ID. */
export const VOICE_ID_RE = /^[A-Za-z0-9]{8,64}$/;

/**
 * ElevenLabs API keys are scoped. A key without the right permission gets a
 * 401 whose detail names the missing permission; turn that into a fix-it hint.
 */
export function permissionHint(detail: string, what: "credits" | "voices"): string | null {
  if (!/permission/i.test(detail)) return null;
  const scope = what === "credits" ? "User → Read" : "Voices → Read";
  return `Your ElevenLabs API key isn't allowed to read ${what}. In ElevenLabs, open Developers → API Keys, edit the key and enable "${scope}". (${detail})`;
}
