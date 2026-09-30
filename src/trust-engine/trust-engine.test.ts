import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, evaluateFact, MemoryFeedbackStore, MOCK_NOW, mockKnowledgeBase as kb, parseContext, parseFeedback } from "./index";
import type { Context, Feedback } from "./types";

const fact = (key: string) => kb.facts.find((f) => f.key === key)!;
const run = (key: string, ctx: Context, feedback: Feedback[] = []) => evaluateFact(fact(key), kb, ctx, feedback, MOCK_NOW);
const scoreOf = (key: string, ctx: Context, claimId: string, feedback: Feedback[] = []) =>
  run(key, ctx, feedback).claims.find((c) => c.claim.id === claimId)?.score;
const PC200: Context = { country: "BE", pc: "200" };
const vote = (userId: string, claimId: string, kind: Feedback["kind"], context: Context = PC200): Feedback => ({
  userId, claimId, kind, context, date: "2026-09-01",
});

test("expert answer after the rule change beats an early guess", () => {
  const r = run("indexation-2026", PC200);
  assert.equal(r.status, "trusted");
  assert.equal(r.best?.claim.value, "1.8%");
  assert.ok(scoreOf("indexation-2026", PC200, "tm-idx-anna")! > 0.9);
  assert.ok(scoreOf("indexation-2026", PC200, "tm-idx-tom")! <= 0.2);
});

test("country and sector decide what applies", () => {
  const bakery = run("indexation-2026", { country: "BE", pc: "118", client: "bakkerij-janssens" });
  assert.equal(bakery.best?.claim.value, "2.0%");
  assert.ok(bakery.claims.every((c) => c.claim.scope.pc === "118"));
  assert.ok(bakery.excluded.some((e) => e.reason.includes("PC 200")));

  const nl = run("holiday-pay", { country: "NL" });
  assert.equal(nl.best?.claim.value, "8%");
  assert.ok(run("holiday-pay", PC200).best?.claim.value === "92%");
});

test("a client agreement is an exception, not a conflict", () => {
  const r = run("end-of-year-bonus", { country: "BE", pc: "200", client: "techstart-gent" });
  assert.equal(r.best?.claim.value, "November");
  assert.equal(r.status, "trusted");
});

test("two experts disagreeing is a conflict", () => {
  assert.equal(run("overtime-recovery", PC200).status, "conflict");
});

test("knowledge without expert or official backing is orphaned", () => {
  assert.equal(run("flexi-job", PC200).status, "orphan");
});

test("feedback moves the score, weighted by role and capped", () => {
  const before = scoreOf("end-of-year-bonus", PC200, "tm-eoy-sofie")!;
  const up = scoreOf("end-of-year-bonus", PC200, "tm-eoy-sofie", [vote("anna", "tm-eoy-sofie", "correct"), vote("jan", "tm-eoy-sofie", "correct")])!;
  const down = scoreOf("end-of-year-bonus", PC200, "tm-eoy-sofie", [vote("anna", "tm-eoy-sofie", "wrong")])!;
  assert.ok(up > before && down < before);

  const many = ["anna", "jan", "an", "lotte", "sofie", "pieter", "tom"].map((u) => vote(u, "tm-eoy-sofie", "wrong"));
  const r = run("end-of-year-bonus", PC200, many).claims.find((c) => c.claim.id === "tm-eoy-sofie")!;
  assert.equal(r.evidence.find((e) => e.layer === "feedback")?.points, -2);
});

test("negative votes cannot sink an official source", () => {
  const votes = ["anna", "jan", "tom"].map((u) => vote(u, "off-idx-200", "wrong"));
  assert.equal(scoreOf("indexation-2026", PC200, "off-idx-200", votes), scoreOf("indexation-2026", PC200, "off-idx-200"));
});

test("'does not apply to me' teaches scope instead of lowering trust", () => {
  const ctx118: Context = { country: "BE", pc: "118" };
  const votes = ["anna", "jan", "pieter"].map((u) => vote(u, "tm-relapse-an", "not_applicable", ctx118));
  assert.ok(run("sick-relapse", ctx118, votes).excluded.some((e) => e.claim.id === "tm-relapse-an"));
  assert.equal(scoreOf("sick-relapse", PC200, "tm-relapse-an", votes), scoreOf("sick-relapse", PC200, "tm-relapse-an"));
});

test("scoring is deterministic", () => {
  assert.deepEqual(run("indexation-2026", PC200), run("indexation-2026", PC200));
});

test("ask matches a question to a fact and warns about bad sources", () => {
  const r = ask("What is the indexation for PC 200?", PC200, kb, [], MOCK_NOW);
  assert.ok(r.matched && r.answer.includes("1.8%") && r.warnings.length === 3);
  assert.equal(ask("what's the weather", PC200, kb, [], MOCK_NOW).matched, false);
});

test("feedback input is validated and one vote per user per claim is kept", () => {
  assert.equal(parseFeedback({ claimId: "nope", kind: "correct", context: PC200 }, "anna", kb).ok, false);
  assert.equal(parseFeedback({ claimId: "tm-idx-tom", kind: "hack", context: PC200 }, "anna", kb).ok, false);
  assert.equal(parseFeedback({ claimId: "tm-idx-tom", kind: "wrong", context: PC200 }, "mallory", kb).ok, false);
  const store = new MemoryFeedbackStore();
  for (const kind of ["wrong", "correct"] as const) {
    const p = parseFeedback({ claimId: "tm-idx-tom", kind, context: PC200 }, "anna", kb);
    assert.ok(p.ok);
    store.put(p.feedback);
  }
  assert.equal(store.all().length, 1);
  assert.equal(store.all()[0].kind, "correct");
});

test("a client id overrides a claimed country or sector", () => {
  assert.deepEqual(parseContext({ client: "bakkerij-janssens", country: "NL", pc: "200" }, kb), {
    country: "BE", pc: "118", client: "bakkerij-janssens",
  });
  assert.equal(parseContext({ country: "belgium" }, kb), null);
});

test("real data: every test question in data/salary gets the expected answer", async () => {
  const { loadDataKnowledgeBase } = await import("./data");
  const { sameValue } = await import("./score");
  const { kb: dataKb, testQuestions } = loadDataKnowledgeBase();
  assert.ok(testQuestions.length >= 8);
  for (const t of testQuestions) {
    const r = ask(t.question, parseContext(t.context, dataKb)!, dataKb, [], MOCK_NOW);
    assert.ok(r.matched && r.best && sameValue(r.best.claim.value, t.expectedAnswer), `${t.question} ${JSON.stringify(t.context)}`);
  }
});
