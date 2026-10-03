import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { ELEVEN_BASE, readElevenEnv, safeUpstreamDetail } from "@/lib/elevenlabs";

export type UsageResponse = {
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix: number | null;
  tier: string;
};

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: "unauthorized", detail: "Your session expired. Sign in again." }, { status: 401, headers: noStore });
  }
  const env = readElevenEnv();
  if (!env) {
    return NextResponse.json(
      { error: "not_configured", detail: "ELEVENLABS_API_KEY must be set on the server." },
      { status: 500, headers: noStore },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ELEVEN_BASE}/v1/user/subscription`, {
      headers: { "xi-api-key": env.apiKey, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "upstream_unreachable", detail: "Couldn't reach ElevenLabs." },
      { status: 502, headers: noStore },
    );
  }

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "elevenlabs_error", detail: safeUpstreamDetail(raw, env, upstream.status) },
      { status: upstream.status, headers: noStore },
    );
  }

  const data = (await upstream.json()) as Partial<UsageResponse>;
  const out: UsageResponse = {
    character_count: Number(data.character_count ?? 0),
    character_limit: Number(data.character_limit ?? 0),
    next_character_count_reset_unix:
      data.next_character_count_reset_unix == null ? null : Number(data.next_character_count_reset_unix),
    tier: String(data.tier ?? "unknown"),
  };
  return NextResponse.json(out, { headers: noStore });
}
