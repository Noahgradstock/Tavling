import { cookies } from "next/headers";
import { revokeSession, sameOrigin, SESSION_COOKIE } from "@/lib/auth";
import { currentSession, forbidden } from "@/lib/trust-server";

// POST -> revokes the session on the server (a copied cookie stops working too) and clears the cookie
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  const current = await currentSession(request);
  if (current) await revokeSession(current.session);
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
