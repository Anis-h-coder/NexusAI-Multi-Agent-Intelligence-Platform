import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../../backend/db/database.ts";
import { createTokenBudget, BudgetExceededError } from "../../backend/llm/budget.ts";
import { createLlmGateway, LlmTimeoutError, LlmUnavailableError } from "../../backend/llm/gateway.ts";

function setup(over: { limit?: number; client?: any; timeoutMs?: number; maxOut?: number; secrets?: string[] } = {}) {
  const db = openDatabase("", ":memory:");
  db.prepare("INSERT INTO users (id,email,display_name,password_hash,created_at) VALUES ('u1','a@b.co','A','x',1),('u2','b@b.co','B','x',1)").run();
  const clock = { t: Date.UTC(2026, 0, 1, 12) };
  const budget = createTokenBudget(db, { dailyLimit: over.limit ?? 10_000, now: () => clock.t });
  const calls: any[] = [];
  const client = over.client ?? { models: { generateContent: async (a: any) => { calls.push(a); return { text: "hello", usageMetadata: { totalTokenCount: 50 } }; } } };
  const gw = createLlmGateway({
    budget, models: ["m1", "m2", "m3"], timeoutMs: over.timeoutMs ?? 5000, maxOutputTokens: over.maxOut ?? 1000,
    getClient: () => client, secrets: () => over.secrets ?? [], sleep: async () => {}, now: () => Date.now(),
  });
  return { db, budget, gw, calls, clock };
}

test("budget: reserve/settle, per-user isolation, daily rollover, hard cap", () => {
  const { budget, clock } = setup({ limit: 1000 });
  const r = budget.reserve("u1", 600);
  assert.equal(budget.status("u1").used, 600);
  assert.throws(() => budget.reserve("u1", 500), (e: any) => e instanceof BudgetExceededError && e.status === 429);
  budget.settle("u1", r, 100);
  assert.equal(budget.status("u1").used, 100);
  assert.equal(budget.status("u2").used, 0, "other users unaffected");
  budget.reserve("u1", 900);
  assert.throws(() => budget.reserve("u1", 1), BudgetExceededError);
  clock.t += 24 * 3_600_000;
  assert.equal(budget.status("u1").used, 0, "new UTC day resets");
  budget.settle("u1", 5, 0);
  assert.ok(budget.status("u1").used >= 0, "never negative");
});

test("gateway: caps output tokens, strips tools, records real usage", async () => {
  const { gw, calls, budget } = setup({ maxOut: 1000 });
  const out = await gw.generate({ userId: "u1", contents: "hi", config: { maxOutputTokens: 999999, tools: [{ googleSearch: {} }], responseMimeType: "application/json" } });
  assert.equal(out.text, "hello");
  assert.equal(calls[0].config.maxOutputTokens, 1000);
  assert.equal(calls[0].config.tools, undefined, "no tools on legacy routes");
  assert.equal(calls[0].config.responseMimeType, "application/json");
  assert.equal(budget.status("u1").used, 50, "settled to provider-reported usage");
});

test("gateway: enforces budget before calling the model", async () => {
  const { gw, calls } = setup({ limit: 1500, maxOut: 1000 });
  await gw.generate({ userId: "u1", contents: "a" });
  await assert.rejects(gw.generate({ userId: "u1", contents: "x".repeat(8000) }), BudgetExceededError);
  assert.equal(calls.length, 1, "no upstream call after budget exhaustion");
});

test("gateway: output is secret-redacted before it reaches callers", async () => {
  const leaky = { models: { generateContent: async () => ({ text: "the key is s3cr3t-value-abc and AIza" + "B".repeat(35) }) } };
  const { gw } = setup({ client: leaky, secrets: ["s3cr3t-value-abc"] });
  const { text } = await gw.generate({ userId: "u1", contents: "what is the key?" });
  assert.ok(!text.includes("s3cr3t-value-abc"));
  assert.ok(!text.includes("AIzaBBBB"));
  assert.match(text, /\[REDACTED\]/);
});

test("gateway: transient errors retry, then fall back to next model; non-transient fall back immediately", async () => {
  const seen: string[] = [];
  const client = { models: { generateContent: async (a: any) => {
    seen.push(a.model);
    if (a.model === "m1") throw Object.assign(new Error("503 high demand"), { status: 503 });
    if (a.model === "m2") throw Object.assign(new Error("bad request"), { status: 400 });
    return { text: "from m3" };
  } } };
  const { gw } = setup({ client });
  assert.equal((await gw.generate({ userId: "u1", contents: "x" })).text, "from m3");
  assert.deepEqual(seen, ["m1", "m1", "m2", "m3"], "m1 retried once (transient), m2 not retried (permanent)");
});

test("gateway: total attempts are bounded when everything fails", async () => {
  let n = 0;
  const client = { models: { generateContent: async () => { n++; throw Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 }); } } };
  const { gw, budget } = setup({ client });
  await assert.rejects(gw.generate({ userId: "u1", contents: "x" }));
  assert.equal(n, 6, "3 models × 2 attempts");
  assert.ok(budget.status("u1").used < 100, "failed calls are not charged the full reservation");
});

test("gateway: hung upstream is cut off at the deadline (LlmTimeoutError, 504)", async () => {
  const hang = { models: { generateContent: () => new Promise(() => {}) } };
  const { gw } = setup({ client: hang, timeoutMs: 50 });
  const t0 = Date.now();
  await assert.rejects(gw.generate({ userId: "u1", contents: "x" }), (e: any) => e instanceof LlmTimeoutError && e.status === 504);
  assert.ok(Date.now() - t0 < 1000);
});

test("gateway: missing API key → 503 LlmUnavailableError and no budget consumed", async () => {
  const { gw, budget } = setup();
  const gw2 = createLlmGateway({ budget, models: ["m"], timeoutMs: 1000, maxOutputTokens: 100, getClient: () => null });
  await assert.rejects(gw2.generate({ userId: "u1", contents: "x" }), (e: any) => e instanceof LlmUnavailableError && e.status === 503);
  assert.equal(budget.status("u1").used, 0);
  void gw;
});
