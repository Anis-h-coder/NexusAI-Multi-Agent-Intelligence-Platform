import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../../backend/db/database.ts";
import { createAuditLog } from "../../backend/security/audit.ts";
import { createRouteErrorSender } from "../../backend/security/route-errors.ts";
import { BudgetExceededError } from "../../backend/llm/budget.ts";
import { LlmTimeoutError, LlmUnavailableError } from "../../backend/llm/gateway.ts";

const KEY = "AIza" + "Q".repeat(35);
function run(err: unknown, secrets: string[] = []) {
  const db = openDatabase("", ":memory:");
  const logs: string[] = [];
  const send = createRouteErrorSender({ audit: createAuditLog(db), log: (m) => logs.push(m), secrets: () => secrets });
  let status = 0, body: any;
  const res: any = { status(c: number) { status = c; return res; }, json(b: any) { body = b; } };
  send({ method: "POST", headers: {}, id: "req-1", ip: "1.1.1.1" } as any, res, err, "Report generation failed");
  return { status, body, logs, db };
}

test("generic failures: safe label + request id only; provider text, keys and paths never reach the client", () => {
  const { status, body } = run(new Error(`PERMISSION_DENIED key=${KEY} at /srv/app/node_modules/x.js`), ["hunter2-hunter2"]);
  assert.equal(status, 500);
  assert.deepEqual(body, { error: "Report generation failed", requestId: "req-1" });
});

test("logs are secret-redacted (known secrets and key-shaped strings) and carry the request id", () => {
  const { logs } = run(new Error(`upstream said: key=${KEY} password=hunter2-hunter2`), ["hunter2-hunter2"]);
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes(KEY) && !logs[0].includes("hunter2-hunter2"), "secret in log line");
  assert.match(logs[0], /req-1/);
  assert.match(logs[0], /\[REDACTED\]/);
});

test("budget/timeout/unavailable map to 429/504/503 with fixed messages; budget is audited", () => {
  const b = run(new BudgetExceededError(10, 10));
  assert.equal(b.status, 429);
  const rows = b.db.prepare("SELECT event FROM audit_log").all() as { event: string }[];
  assert.deepEqual(rows.map((r) => r.event), ["budget_exceeded"]);
  assert.equal(run(new LlmTimeoutError()).status, 504);
  assert.equal(run(new LlmUnavailableError()).status, 503);
  assert.equal(b.logs.length, 0, "expected failures are not logged as errors");
});
