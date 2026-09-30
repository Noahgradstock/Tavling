import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

export function createSession(userId: string, now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET (32+ characters) is not set");
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(now / 1000) + SESSION_TTL_S })).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

// Returns the user id of a valid, unexpired session, or null.
export function verifySession(token: string | undefined | null, now = Date.now()): string | null {
  const key = secret();
  if (!key || !token) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined || !safeEqual(sig, sign(payload, key))) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof sub !== "string" || typeof exp !== "number" || exp * 1000 <= now) return null;
    return sub;
  } catch {
    return null;
  }
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

// Fixed-window counters in memory (per server instance). Used for login attempts and expensive routes.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function overLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  return !!b && b.resetAt > now && b.count >= max;
}

export function hit(key: string, windowMs: number, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else b.count++;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

// Allows `max` calls per window; returns false once the limit is reached.
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  if (overLimit(key, max, windowMs, now)) return false;
  hit(key, windowMs, now);
  return true;
}

// Failed logins: 5 per account per IP, and 50 per IP overall, per 15 minutes.
// Keying on account + IP means a stranger cannot lock a colleague out by guessing wrong on purpose.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function loginBlocked(userId: string, ip = "unknown", now = Date.now()): boolean {
  return overLimit(`login:${userId}|${ip}`, 5, LOGIN_WINDOW_MS, now) || overLimit(`login-ip:${ip}`, 50, LOGIN_WINDOW_MS, now);
}

export function recordLoginFailure(userId: string, ip = "unknown", now = Date.now()) {
  hit(`login:${userId}|${ip}`, LOGIN_WINDOW_MS, now);
  hit(`login-ip:${ip}`, LOGIN_WINDOW_MS, now);
}

export const clearLoginFailures = (userId: string, ip = "unknown") => buckets.delete(`login:${userId}|${ip}`);

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
