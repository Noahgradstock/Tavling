import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeSession,
  createSession,
  hashPassword,
  loginBlocked,
  rateLimit,
  readSession,
  recordLoginFailure,
  revokeSession,
  sameOrigin,
  SESSION_TTL_S,
  verifyPassword,
  verifySession,
} from "./auth";
import { UpstashStore } from "./store";
import { canReadClaim, canUseContext, clientsOf } from "./access";
import { mockKnowledgeBase as kb } from "@/trust-engine";

// auth.ts reads the environment on every call, so setting it here is enough.
process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.AUTH_USERS = `sofie:${hashPassword("correct horse")},tom:${hashPassword("battery staple")}`;

test("a signed session round-trips and expires", () => {
  const t = Date.parse("2026-09-30T12:00:00Z");
  const token = createSession("sofie", t);
  assert.equal(verifySession(token, t), "sofie");
  assert.equal(verifySession(token, t + SESSION_TTL_S * 1000), null);
});

test("a tampered or forged session is rejected", () => {
  const token = createSession("sofie");
  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "anna", sid: "x", exp: 9_999_999_999 })).toString("base64url");
  assert.equal(verifySession(`${forged}.${sig}`), null);
  assert.equal(verifySession(`${payload}.${sig.slice(0, -2)}xx`), null);
  assert.equal(verifySession(`${payload}.${sig}.extra`), null);
  assert.equal(verifySession("anna"), null);
});

test("logout revokes the session, also for a copied cookie", async () => {
  const token = createSession("sofie");
  const copy = token;
  assert.ok(await activeSession(token));
  await revokeSession(readSession(token)!);
  assert.equal(await activeSession(copy), null);
  assert.ok(await activeSession(createSession("sofie")), "a new login still works");
});

test("changing a password ends that user's sessions", () => {
  const token = createSession("sofie");
  const before = process.env.AUTH_USERS;
  process.env.AUTH_USERS = `sofie:${hashPassword("new password")}`;
  assert.equal(verifySession(token), null);
  process.env.AUTH_USERS = before;
});

test("passwords are checked against scrypt hashes", () => {
  assert.equal(verifyPassword("sofie", "correct horse"), true);
  assert.equal(verifyPassword("sofie", "wrong"), false);
  assert.equal(verifyPassword("anna", "correct horse"), false);
});

test("repeated failed logins block that account from that IP only", async () => {
  for (let i = 0; i < 5; i++) await recordLoginFailure("tom", "1.1.1.1");
  assert.equal(await loginBlocked("tom", "1.1.1.1"), true);
  assert.equal(await loginBlocked("tom", "2.2.2.2"), false); // a stranger cannot lock Tom out everywhere
  assert.equal(await loginBlocked("sofie", "1.1.1.1"), false);
});

test("rate limits stop after the maximum", async () => {
  for (let i = 0; i < 3; i++) assert.equal(await rateLimit("test:x", 3, 60_000), true);
  assert.equal(await rateLimit("test:x", 3, 60_000), false);
});

test("cross-site requests are refused", () => {
  const req = (origin: string | null) =>
    new Request("https://app.example/api/trust/feedback", { method: "POST", headers: origin ? { origin } : {} });
  assert.equal(sameOrigin(req("https://app.example")), true);
  assert.equal(sameOrigin(req("https://evil.example")), false);
});

test("the Upstash store sends the right Redis commands", async () => {
  const sent: unknown[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    assert.equal(url, "https://redis.example/pipeline");
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer t0ken");
    const cmds = JSON.parse(String(init.body)) as unknown[][];
    sent.push(...cmds);
    return new Response(JSON.stringify(cmds.map((c) => ({ result: c[0] === "INCR" ? 4 : c[0] === "EXISTS" ? 1 : "OK" }))));
  }) as typeof fetch;
  const s = new UpstashStore("https://redis.example/", "t0ken", fakeFetch);
  assert.equal(await s.count("rl:a", 60_000), 4);
  assert.equal(await s.flagged("revoked:x"), true);
  await s.flag("revoked:y", 1000);
  assert.deepEqual(sent, [["INCR", "rl:a"], ["PEXPIRE", "rl:a", 60_000, "NX"], ["EXISTS", "revoked:x"], ["SET", "revoked:y", "1", "PX", 1000]]);
});

test("consultants only reach their own clients; experts all clients in their country", () => {
  const person = (id: string) => kb.people.find((p) => p.id === id)!;
  const tom = person("tom");
  const anna = person("anna");
  const emma = person("emma");
  assert.deepEqual(clientsOf(tom, kb).map((c) => c.id), ["brouwerij-de-kroon"]);
  assert.ok(clientsOf(anna, kb).length > 1 && clientsOf(anna, kb).every((c) => c.country === "BE"));
  assert.equal(canUseContext(tom, { country: "BE", pc: "118", client: "bakkerij-janssens" }, kb), false);
  assert.equal(canUseContext(tom, { country: "BE", pc: "200" }, kb), true);
  assert.equal(canUseContext(emma, { country: "BE" }, kb), false);
  const clientEmail = kb.claims.find((c) => c.scope.client === "bakkerij-janssens")!;
  assert.equal(canReadClaim(tom, clientEmail, kb), false);
  assert.equal(canReadClaim(anna, clientEmail, kb), true);
});
