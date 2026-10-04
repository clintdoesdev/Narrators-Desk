import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthed } from "@/lib/auth";
import { ELEVEN_BASE, VOICE_ID_RE, readElevenEnv, safeUpstreamDetail } from "@/lib/elevenlabs";
import { MAX_CHUNK_CHARS } from "@/lib/parser";
import { MAX_SEED, OUTPUT_FORMAT, VOICE_CONFIG } from "@/lib/voice-config";

export const maxDuration = 120;

const Body = z.object({
  text: z.string().min(1).max(MAX_CHUNK_CHARS),
  model: z.enum(["v2", "v3"]),
  seed: z.number().int().min(0).max(MAX_SEED),
  // Omitted or "default" uses VOICE_ID from the environment.
  voiceId: z.union([z.literal("default"), z.string().regex(VOICE_ID_RE)]).optional(),
});

function jsonError(status: number, error: string, detail: string, extra?: HeadersInit) {
  return NextResponse.json({ error, detail }, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(request: Request) {
  if (!(await isAuthed(request))) return jsonError(401, "unauthorized", "Your session expired. Sign in again.");

  const env = readElevenEnv();
  if (!env) return jsonError(500, "not_configured", "ELEVENLABS_API_KEY and VOICE_ID must be set on the server.");

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch (e) {
    const detail = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Invalid JSON.";
    return jsonError(400, "bad_request", detail);
  }

  const cfg = VOICE_CONFIG[body.model];
  const voiceId = body.voiceId && body.voiceId !== "default" ? body.voiceId : env.voiceId;
  const url = `${ELEVEN_BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": env.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: body.text,
        model_id: cfg.modelId,
        voice_settings: cfg.voiceSettings,
        seed: body.seed,
      }),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    if (request.signal.aborted) return jsonError(499, "cancelled", "Request cancelled.");
    return jsonError(502, "upstream_unreachable", "Couldn't reach ElevenLabs. Try again in a moment.");
  }

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    const retryAfter = upstream.headers.get("retry-after");
    const code = upstream.status === 401 ? "elevenlabs_unauthorized" : "elevenlabs_error";
    return jsonError(
      upstream.status,
      code,
      safeUpstreamDetail(raw, env, upstream.status),
      retryAfter ? { "Retry-After": retryAfter } : undefined,
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
