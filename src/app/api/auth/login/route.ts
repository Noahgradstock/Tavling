import { cookies } from "next/headers";
import {
  authConfigured,
  clearLoginFailures,
  clientIp,
  cookieOptions,
  createSession,
  loginBlocked,
  recordLoginFailure,
  sameOrigin,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { forbidden, kb, readJson } from "@/lib/trust-server";

// POST { username, password } -> sets the signed session cookie
export async function POST(request: Request) {
  if (!sameOrigin(request)) return forbidden();
  if (!authConfigured()) return Response.json({ error: "Login is not configured on this server" }, { status: 503 });

  const body = (await readJson(request)) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase().slice(0, 64) : "";
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  if (!username || !password) return Response.json({ error: "Username and password are required" }, { status: 400 });

  const ip = clientIp(request);
  if (loginBlocked(username, ip)) return Response.json({ error: "Too many attempts, try again in 15 minutes" }, { status: 429 });

  const person = kb.people.find((p) => p.id === username && !p.left);
  if (!verifyPassword(username, password) || !person) {
    recordLoginFailure(username, ip);
    return Response.json({ error: "Wrong username or password" }, { status: 401 });
  }

  clearLoginFailures(username, ip);
  (await cookies()).set(SESSION_COOKIE, createSession(person.id), cookieOptions);
  return Response.json({ user: { id: person.id, name: person.name, role: person.role } });
}
