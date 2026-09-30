import { cookies } from "next/headers";
import { clientIp, cookieOptions, createSession, GUEST_ID, guestEnabled, rateLimit, sameOrigin, SESSION_COOKIE } from "@/lib/auth";
import { forbidden, tooManyRequests } from "@/lib/trust-server";

// POST -> signs in as the shared demo guest. Guests can ask questions but not vote (see canVote in lib/access.ts).
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!guestEnabled()) return Response.json({ error: "Guest access is switched off" }, { status: 403 });
  if (!(await rateLimit(`guest:${clientIp(request)}`, 10, 60_000))) return tooManyRequests();
  try {
    (await cookies()).set(SESSION_COOKIE, createSession(GUEST_ID), cookieOptions);
  } catch {
    return Response.json({ error: "Login is not configured on this server" }, { status: 503 });
  }
  return Response.json({ user: { id: GUEST_ID, name: "Guest", role: "regular" } });
}
