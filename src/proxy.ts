import { NextResponse, type NextRequest } from "next/server";
import { activeSession, SESSION_COOKIE } from "@/lib/auth";

// Everything except the login page and the login/guest endpoints needs a valid, not logged-out session.
// Route handlers check the session again (defense in depth), this is the first gate.
const PUBLIC = new Set(["/login", "/api/auth/login", "/api/auth/guest"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.has(pathname)) return NextResponse.next();
  if (await activeSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
