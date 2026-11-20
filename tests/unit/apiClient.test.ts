import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { safeFetchJson, setCsrfToken, onUnauthorized } from "../../src/utils/apiClient.ts";

type Seen = { url: string; init: RequestInit & { headers: Headers } };
let seen: Seen[] = [];
function fakeFetch(respond: (url: string) => Response) {
  (globalThis as any).fetch = async (url: string, init: any) => { seen.push({ url, init }); return respond(url); };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => { seen = []; setCsrfToken(null); });

test("always sends credentials same-origin; GET never carries the CSRF token", async () => {
  fakeFetch(() => json({ ok: 1 }));
  setCsrfToken("tok-123");
  await safeFetchJson("/api/health");
  assert.equal(seen[0].init.credentials, "same-origin");
  assert.equal(seen[0].init.headers.get("x-csrf-token"), null);
});

test("unsafe methods carry X-CSRF-Token and keep caller headers", async () => {
  fakeFetch(() => json({ ok: 1 }));
  setCsrfToken("tok-123");
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    await safeFetchJson("/api/x", { method, headers: { "Content-Type": "application/json" }, body: "{}" });
  }
  assert.equal(seen.length, 4);
  for (const s of seen) {
    assert.equal(s.init.headers.get("x-csrf-token"), "tok-123");
    assert.equal(s.init.headers.get("content-type"), "application/json");
  }
});

test("token is not sent after it is cleared (logout)", async () => {
  fakeFetch(() => json({}));
  setCsrfToken("t");
  setCsrfToken(null);
  await safeFetchJson("/api/x", { method: "POST", body: "{}" });
  assert.equal(seen[0].init.headers.get("x-csrf-token"), null);
});

test("401 from a protected API notifies listeners; auth endpoints do not (no redirect loops); unsubscribe works", async () => {
  fakeFetch((url) => json({ error: "Authentication required" }, 401));
  let fired = 0;
  const off = onUnauthorized(() => { fired++; });
  const r = await safeFetchJson("/api/agents/chat", { method: "POST" });
  assert.equal(r.ok, false); assert.equal(r.status, 401);
  assert.equal(fired, 1);
  await safeFetchJson("/api/auth/me");
  await safeFetchJson("/api/auth/login", { method: "POST" });
  assert.equal(fired, 1, "auth endpoints must not trigger the global sign-out");
  off();
  await safeFetchJson("/api/rag/query", { method: "POST" });
  assert.equal(fired, 1);
});

test("existing resilience is preserved: HTML error pages and network failures never throw", async () => {
  fakeFetch(() => new Response("<!DOCTYPE html><html></html>", { status: 502, headers: { "content-type": "text/html" } }));
  const html = await safeFetchJson("/api/x");
  assert.equal(html.ok, false); assert.match(html.error!, /HTML document/);
  (globalThis as any).fetch = async () => { throw new Error("socket hang up"); };
  const net = await safeFetchJson("/api/x");
  assert.deepEqual([net.ok, net.status, net.error], [false, 0, "socket hang up"]);
});
