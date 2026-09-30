import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { store } from "@/lib/store";

// Session and password helpers. No framework imports, so the proxy, route handlers and tests share them.
// Sessions are signed cookies: base64url(payload).HMAC-SHA256(payload, SESSION_SECRET).
// Passwords live only as scrypt hashes in AUTH_USERS ("id:salt:hash,id:salt:hash"), never in the repo.

export const SESSION_COOKIE = "session";
export const SESSION_TTL_S = 8 * 60 * 60;

export const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_S,
};

export type Session = { sub: string; sid: string; exp: number };

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export const authConfigured = () => secret() !== null && users().size > 0;

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Password version: changes when the user's password (salt) changes, which ends all their sessions.
const passwordVersion = (userId: string) => users().get(userId)?.salt.slice(0, 8) ?? null;

export function createSession(userId: string, now = Date.now()): string {
  const key = secret();
  const pv = passwordVersion(userId);
  if (!key) throw new Error("SESSION_SECRET (32+ characters) is not set");
  if (!pv) throw new Error("Unknown user");
  const body = { sub: userId, sid: randomBytes(16).toString("base64url"), pv, exp: Math.floor(now / 1000) + SESSION_TTL_S };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

// Signature, expiry and password version. Synchronous, so the proxy can use it; see isRevoked() for logout.
export function readSession(token: string | undefined | null, now = Date.now()): Session | null {
  const key = secret();
  if (!key || !token) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || !safeEqual(sig, sign(payload, key))) return null;
  try {
    const { sub, sid, pv, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof sub !== "string" || typeof sid !== "string" || typeof exp !== "number" || exp * 1000 <= now) return null;
    if (pv !== passwordVersion(sub)) return null;
    return { sub, sid, exp };
  } catch {
    return null;
  }
}

// Returns the user id of a valid, unexpired session, or null (without the revocation check).
export const verifySession = (token: string | undefined | null, now = Date.now()) => readSession(token, now)?.sub ?? null;

// Logout: the session id is revoked until the moment the token would have expired anyway.
export async function revokeSession(session: Session, now = Date.now()) {
  await store.flag(`revoked:${session.sid}`, session.exp * 1000 - now);
}

export async function isRevoked(session: Session): Promise<boolean> {
  try {
    return await store.flagged(`revoked:${session.sid}`);
  } catch (err) {
    console.error("revocation check failed, refusing the session:", err);
    return true; // fail closed
  }
}

// Full check: signature, expiry, password version and not logged out.
export async function activeSession(token: string | undefined | null): Promise<Session | null> {
  const session = readSession(token);
  return session && !(await isRevoked(session)) ? session : null;
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function users(): Map<string, { salt: string; hash: string }> {
  const map = new Map<string, { salt: string; hash: string }>();
  for (const entry of (process.env.AUTH_USERS ?? "").split(",")) {
    const [id, salt, hash] = entry.trim().split(":");
    if (id && salt && hash) map.set(id, { salt, hash });
  }
  return map;
}

// Constant work whether or not the user exists, so response time does not reveal valid user ids.
const DUMMY = { salt: "0".repeat(32), hash: "0".repeat(64) };

export function verifyPassword(userId: string, password: string): boolean {
  const known = users().get(userId);
  const { salt, hash } = known ?? DUMMY;
  const actual = scryptSync(password, salt, 32).toString("hex");
  return safeEqual(actual, hash) && !!known;
}

// Allows `max` calls per window; returns false once the limit is reached. Fails open if the store is down.
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    return (await store.count(`rl:${key}`, windowMs)) <= max;
  } catch (err) {
    console.error("rate limit store failed:", err);
    return true;
  }
}

// Failed logins: 5 per account per IP, and 50 per IP overall, per 15 minutes.
// Keying on account + IP means a stranger cannot lock a colleague out by guessing wrong on purpose.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function loginBlocked(userId: string, ip = "unknown"): Promise<boolean> {
  const [perAccount, perIp] = await Promise.all([store.peek(`login:${userId}|${ip}`), store.peek(`login-ip:${ip}`)]);
  return perAccount >= 5 || perIp >= 50;
}

export async function recordLoginFailure(userId: string, ip = "unknown") {
  await Promise.all([store.count(`login:${userId}|${ip}`, LOGIN_WINDOW_MS), store.count(`login-ip:${ip}`, LOGIN_WINDOW_MS)]);
}

export const clearLoginFailures = (userId: string, ip = "unknown") => store.del(`login:${userId}|${ip}`);

// Client IP as set by the hosting proxy (Vercel puts the real client first).
export const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// CSRF guard for state-changing requests: a browser request must come from our own origin.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
