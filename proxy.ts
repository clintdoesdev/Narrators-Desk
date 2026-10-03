import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; behaviour is the same.
 * Every route except the login page/API and static assets needs a valid session.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "unauthorized", detail: "Sign in again." },
      { status: 401 },
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Skip Next internals and the public icon/manifest files the login page needs.
    "/((?!_next/static|_next/image|icon.svg|apple-icon|manifest.webmanifest|favicon.ico).*)",
  ],
};
