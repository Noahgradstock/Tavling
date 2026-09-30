import assert from "node:assert/strict";
import { test } from "node:test";

import { createSession, hashPassword, loginBlocked, recordLoginFailure, sameOrigin, SESSION_TTL_S, verifyPassword, verifySession } from "./auth";

// auth.ts reads the environment on every call, so setting it here is enough.
process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
process.env.AUTH_USERS = `sofie:${hashPassword("correct horse")}`;

test("a signed session round-trips and expires", () => {
  const t = Date.parse("2026-09-30T12:00:00Z");
  const token = createSession("sofie", t);
  assert.equal(verifySession(token, t), "sofie");
  assert.equal(verifySession(token, t + SESSION_TTL_S * 1000), null);
});

test("a tampered or forged session is rejected", () => {
  const token = createSession("sofie");
  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "anna", exp: 9_999_999_999 })).toString("base64url");
  assert.equal(verifySession(`${forged}.${sig}`), null);
  assert.equal(verifySession(`${payload}.${sig.slice(0, -2)}xx`), null);
  assert.equal(verifySession(`${payload}.${sig}.extra`), null);
  assert.equal(verifySession("anna"), null);
});

test("passwords are checked against scrypt hashes", () => {
  assert.equal(verifyPassword("sofie", "correct horse"), true);
  assert.equal(verifyPassword("sofie", "wrong"), false);
  assert.equal(verifyPassword("anna", "correct horse"), false);
});

test("repeated failed logins block the account", () => {
  for (let i = 0; i < 5; i++) recordLoginFailure("tom");
  assert.equal(loginBlocked("tom"), true);
  assert.equal(loginBlocked("sofie"), false);
});

test("cross-site requests are refused", () => {
  const req = (origin: string | null) =>
    new Request("https://app.example/api/trust/feedback", { method: "POST", headers: origin ? { origin } : {} });
  assert.equal(sameOrigin(req("https://app.example")), true);
  assert.equal(sameOrigin(req("https://evil.example")), false);
});
