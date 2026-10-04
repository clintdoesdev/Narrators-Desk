import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { ELEVEN_BASE, permissionHint, readElevenEnv, safeUpstreamDetail } from "@/lib/elevenlabs";

export type VoiceOption = {
  /** "default" for the env VOICE_ID, so that ID never reaches the browser. */
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  previewUrl: string | null;
  isDefault: boolean;
};

type UpstreamVoice = {
  voice_id?: string;
  name?: string;
  category?: string;
  description?: string | null;
  preview_url?: string | null;
  labels?: Record<string, string>;
};

const noStore = { "Cache-Control": "no-store" };

function describe(v: UpstreamVoice): string | null {
  const labels = v.labels ? Object.values(v.labels).filter(Boolean) : [];
  if (labels.length) return labels.slice(0, 3).join(" · ");
  return v.description ? v.description.slice(0, 80) : null;
}

/** Lists the voices on the ElevenLabs account (My Voices plus premade). */
export async function GET(request: Request) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: "unauthorized", detail: "Your session expired. Sign in again." }, { status: 401, headers: noStore });
  }
  const env = readElevenEnv();
  if (!env) {
    return NextResponse.json(
      { error: "not_configured", detail: "ELEVENLABS_API_KEY and VOICE_ID must be set on the server." },
      { status: 500, headers: noStore },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ELEVEN_BASE}/v2/voices?page_size=100`, {
      headers: { "xi-api-key": env.apiKey, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable", detail: "Couldn't reach ElevenLabs." }, { status: 502, headers: noStore });
  }

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    const detail = safeUpstreamDetail(raw, env, upstream.status);
    const hint = permissionHint(detail, "voices");
    return NextResponse.json(
      { error: hint ? "missing_permission" : "elevenlabs_error", detail: hint ?? detail },
      { status: upstream.status, headers: noStore },
    );
  }

  const data = (await upstream.json().catch(() => ({}))) as { voices?: UpstreamVoice[] };
  const list = Array.isArray(data.voices) ? data.voices : [];

  const fromEnv = list.find((v) => v.voice_id === env.voiceId);
  const others: VoiceOption[] = list
    .filter((v) => v.voice_id && v.voice_id !== env.voiceId && v.name)
    .map((v) => ({
      id: v.voice_id!,
      name: v.name!,
      category: v.category ?? null,
      description: describe(v),
      previewUrl: v.preview_url ?? null,
      isDefault: false,
    }))
    .sort((a, b) => {
      // Your own voices first, then premade, alphabetically within each.
      const rank = (c: string | null) => (c === "premade" ? 1 : 0);
      return rank(a.category) - rank(b.category) || a.name.localeCompare(b.name);
    });

  const defaultVoice: VoiceOption = {
    id: "default",
    name: fromEnv?.name ?? "Your voice",
    category: fromEnv?.category ?? null,
    description: fromEnv ? describe(fromEnv) : null,
    // Preview URLs embed the voice ID, so the default's is withheld.
    previewUrl: null,
    isDefault: true,
  };

  return NextResponse.json({ voices: [defaultVoice, ...others] }, { headers: noStore });
}
