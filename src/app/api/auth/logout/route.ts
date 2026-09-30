import { cookies } from "next/headers";
import { sameOrigin, SESSION_COOKIE } from "@/lib/auth";
import { forbidden } from "@/lib/trust-server";

// POST -> clears the session cookie
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
