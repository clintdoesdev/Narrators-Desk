import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  constantTimeEqual,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { clientIp, delayFor, recordFailure, recordSuccess } from "@/lib/rate-limit";

const Body = z.object({ password: z.string().min(1).max(512) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: Request) {
  const ip = clientIp(request);
  const wait = delayFor(ip);
  if (wait > 0) await sleep(wait);

  const expected = process.env.APP_PASSWORD;
  if (!expected || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: "not_configured", detail: "APP_PASSWORD and SESSION_SECRET must be set on the server." },
      { status: 500 },
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "bad_request", detail: "Password required." }, { status: 400 });
  }

  const ok = await constantTimeEqual(parsed.password, expected);
  if (!ok) {
    recordFailure(ip);
    return NextResponse.json({ error: "invalid", detail: "That password isn't right." }, { status: 401 });
  }

  recordSuccess(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return res;
}
