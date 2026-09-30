import { NextResponse, type NextRequest } from "next/server";
import { activeSession, cookieOptions, createSession, GUEST_ID, guestEnabled, SESSION_COOKIE } from "@/lib/auth";

// Everything except the login page and the login/guest endpoints needs a valid, not logged-out session.
// Visitors without one are signed in as the read-only demo guest, so the demo opens without a login screen.
// Route handlers check the session again (defense in depth), this is the first gate.
const PUBLIC = new Set(["/login", "/api/auth/login", "/api/auth/guest"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.has(pathname)) return NextResponse.next();
  if (await activeSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  if (guestEnabled()) {
    try {
      const token = createSession(GUEST_ID);
      // Set it on this request too, so the page renders signed in straight away.
      request.cookies.set(SESSION_COOKIE, token);
      const res = NextResponse.next({ request: { headers: request.headers } });
      res.cookies.set(SESSION_COOKIE, token, cookieOptions);
      return res;
    } catch {
      // No session secret configured: fall through to the login page.
    }
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
