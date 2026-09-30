import { cookies } from "next/headers";
import { cookieOptions, createSession, sameOrigin, SESSION_COOKIE } from "@/lib/auth";
import { forbidden } from "@/lib/trust-server";

// POST -> signs in as the shared demo guest. Guests can ask and vote (one vote per claim for all guests together).
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  try {
    (await cookies()).set(SESSION_COOKIE, createSession("guest"), cookieOptions);
  } catch {
    return Response.json({ error: "Login is not configured on this server" }, { status: 503 });
  }
  return Response.json({ user: { id: "guest", name: "Guest", role: "regular" } });
}
