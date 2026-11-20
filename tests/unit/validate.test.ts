import { test } from "node:test";
import assert from "node:assert/strict";
import { string, oneOf, array, object, rows, parse, validateBody, SAFE_IDENTIFIER, SAFE_COLUMN_LABEL } from "../../backend/security/validate.ts";

test("string: required/optional, trims, strips control chars, bounds length, never echoes the value", () => {
  const s = string({ max: 5 });
  assert.deepEqual(parse(s, "  ab\u0000c "), { ok: true, value: "abc" });
  assert.equal(parse(s, "").ok, false);
  assert.equal(parse(s, undefined).ok, false);
  assert.equal(parse(s, 5).ok, false);
  const long = parse(s, "SECRET-VALUE-123");
  assert.equal(long.ok, false);
  assert.ok(!JSON.stringify(long).includes("SECRET-VALUE"));
  assert.deepEqual(parse(string({ max: 5, optional: true }), undefined), { ok: true, value: undefined });
  assert.deepEqual(parse(string({ max: 5, optional: true }), "   "), { ok: true, value: undefined });
});

test("object: unknown keys are dropped (mass-assignment / prompt-field smuggling), prototype keys ignored", () => {
  const schema = object({ message: string({ max: 100 }), role: oneOf(["user", "assistant"] as const, { optional: true }) });
  const r = parse(schema, JSON.parse('{"message":"hi","isAdmin":true,"__proto__":{"polluted":1},"systemPrompt":"x"}'));
  assert.deepEqual(r, { ok: true, value: { message: "hi" } });
  assert.equal(({} as any).polluted, undefined);
  assert.equal(parse(schema, "str").ok, false);
  assert.equal(parse(schema, [1]).ok, false);
  assert.equal(parse(schema, { message: "x", role: "system" }).ok, false, "enum rejects 'system'");
});

test("array bounds and per-item validation", () => {
  const s = array(string({ max: 3 }), { max: 2 });
  assert.equal(parse(s, ["a", "b", "c"]).ok, false);
  assert.equal(parse(s, ["abcd"]).ok, false);
  assert.deepEqual(parse(s, ["a", "b"]), { ok: true, value: ["a", "b"] });
  assert.equal(parse(s, "a").ok, false);
});

test("rows: bounded size, primitives only, hostile keys rejected", () => {
  const s = rows({ maxRows: 2, maxKeys: 2, maxString: 5 });
  assert.deepEqual(parse(s, [{ a: "123456789", b: 1 }]), { ok: true, value: [{ a: "12345", b: 1 }] });
  assert.equal(parse(s, [{}, {}, {}]).ok, false);
  assert.equal(parse(s, [{ a: 1, b: 2, c: 3 }]).ok, false);
  assert.equal(parse(s, [{ a: { nested: 1 } }]).ok, false);
  assert.equal(parse(s, [{ a: Infinity }]).ok, false);
  assert.equal(parse(s, [JSON.parse('{"__proto__": 1}')]).ok, false);
  assert.equal(parse(s, ["str"]).ok, false);
});

test("validateBody middleware replaces body or answers 400 with field errors only", () => {
  const mw = validateBody(object({ q: string({ max: 3 }) }));
  let status = 200, body: any, nexted = false;
  const res: any = { status(c: number) { status = c; return res; }, json(b: any) { body = b; } };
  const req: any = { body: { q: "ok", extra: 1 } };
  mw(req, res, () => { nexted = true; });
  assert.ok(nexted); assert.deepEqual(req.body, { q: "ok" });
  nexted = false;
  mw({ body: { q: "toolong-and-secret" } } as any, res, () => { nexted = true; });
  assert.equal(nexted, false); assert.equal(status, 400);
  assert.ok(!JSON.stringify(body).includes("secret"));
});

test("identifier patterns reject SQL metacharacters", () => {
  for (const ok of ["customers", "_t1", "Customer_Churn"]) assert.ok(SAFE_IDENTIFIER.test(ok), ok);
  for (const bad of ["a b", "x;DROP TABLE y", "t--", "1abc", 'a"b', "", "a".repeat(64), "t`x"]) assert.ok(!SAFE_IDENTIFIER.test(bad), bad);
  for (const ok of ["Customer ID", "revenue (USD)", "Plan-Tier", "% churn", "Größe"]) assert.ok(SAFE_COLUMN_LABEL.test(ok), ok);
  for (const bad of ["a;b", "x'y", 'x"y', "a`b", "x\ny", "a".repeat(65), ""]) assert.ok(!SAFE_COLUMN_LABEL.test(bad), JSON.stringify(bad));
});
