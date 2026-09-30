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

// Failed login attempts per user id, in memory. Blocks brute force on one account.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginBlocked(userId: string, now = Date.now()): boolean {
  const a = attempts.get(userId);
  return !!a && a.resetAt > now && a.count >= MAX_ATTEMPTS;
}

export function recordLoginFailure(userId: string, now = Date.now()) {
  const a = attempts.get(userId);
  if (!a || a.resetAt <= now) attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
  else a.count++;
}

export const clearLoginFailures = (userId: string) => attempts.delete(userId);

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
