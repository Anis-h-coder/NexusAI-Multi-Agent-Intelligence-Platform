/**
 * REAL-HTTP tests: the actual server.ts runs in a separate OS process behind a node:http bridge and is exercised over TCP.
 * Verifies cookie transport, CSRF, session persistence across a process restart, isolation, CORS, body limits and secrets at rest.
 * Stubbed (not real): the Express routing/body-parser internals and the Gemini SDK. See docs/PHASE2_VERIFICATION.md.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, request, postJson, signup, authHeaders, allFilesText, PW, type Server } from "./helpers.ts";

let srv: Server;
let staticDir: string;
before(async () => {
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-static-"));
  fs.writeFileSync(path.join(staticDir, "index.html"), "<!doctype html><title>t</title><div id=root></div>");
  srv = await startServer({ staticDir, env: { ALLOWED_ORIGINS: "https://ui.example.com" } });
});
after(async () => { await srv.stop(); });

test("register over real HTTP: cookie attributes on the wire; response carries no secrets", async () => {
  const r = await postJson(srv.base, "/api/auth/register", { email: "wire@example.com", password: PW, displayName: "W" });
  assert.equal(r.status, 201);
  assert.equal(r.setCookie.length, 1);
  const c = r.setCookie[0];
  assert.match(c, /^__Host-nexus_sid=/);
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age="]) assert.ok(c.includes(attr), `missing ${attr}: ${c}`);
  assert.ok(!/Domain=/i.test(c), "__Host- cookies must not set Domain");
  assert.match(r.headers["content-type"] as string, /application\/json/);
  assert.ok(!r.text.includes(PW) && !/hash|scrypt/i.test(r.text), "no password/hash in the response");
  assert.equal(r.json.user.email, "wire@example.com");
  assert.ok(r.json.csrfToken.length >= 20);
});

test("session: valid cookie → /me; no cookie → 401; garbage cookie → 401 and the cookie is cleared", async () => {
  const s = await signup(srv.base, "sess");
  const me = await request(srv.base, { path: "/api/auth/me", headers: { cookie: s.cookie } });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, s.email);
  assert.equal(me.json.csrfToken, s.csrf);
  assert.equal((await request(srv.base, { path: "/api/auth/me" })).status, 401);
  const bad = await request(srv.base, { path: "/api/auth/me", headers: { cookie: "__Host-nexus_sid=" + "z".repeat(43) } });
  assert.equal(bad.status, 401);
  assert.ok(bad.setCookie.some((c) => /Max-Age=0/.test(c)), "invalid session cookie must be expired");
});

test("CSRF over HTTP: protected POST needs the session token; GET does not", async () => {
  const s = await signup(srv.base, "csrf");
  const body = { sql: "SELECT 1" };
  const noTok = await postJson(srv.base, "/api/sql/execute", body, { cookie: s.cookie });
  assert.equal(noTok.status, 403);
  const wrongTok = await postJson(srv.base, "/api/sql/execute", body, { cookie: s.cookie, "x-csrf-token": "x".repeat(32) });
  assert.equal(wrongTok.status, 403);
  const ok = await postJson(srv.base, "/api/sql/execute", body, { cookie: s.cookie, "x-csrf-token": s.csrf });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await request(srv.base, { path: "/api/does-not-exist", headers: { cookie: s.cookie } })).status, 404);
  assert.equal((await request(srv.base, { path: "/api/does-not-exist" })).status, 401, "unknown routes do not reveal existence to anonymous callers");
});

test("isolation over HTTP: each cookie resolves only to its own user; B cannot use A's CSRF token; tokens differ per user", async () => {
  const a = await signup(srv.base, "iso-a");
  const b = await signup(srv.base, "iso-b");
  assert.equal((await request(srv.base, { path: "/api/auth/me", headers: { cookie: a.cookie } })).json.user.email, a.email);
  assert.equal((await request(srv.base, { path: "/api/auth/me", headers: { cookie: b.cookie } })).json.user.email, b.email);
  const cross = await postJson(srv.base, "/api/sql/execute", { sql: "SELECT 1" }, { cookie: b.cookie, "x-csrf-token": a.csrf });
  assert.equal(cross.status, 403);
  assert.notEqual(a.rawToken, b.rawToken);
  assert.notEqual(a.csrf, b.csrf);
});

test("login: generic failure without Set-Cookie; repeated failures lock (429 + Retry-After); logout needs CSRF and kills the session", async () => {
  const s = await signup(srv.base, "login");
  const bad = await postJson(srv.base, "/api/auth/login", { email: s.email, password: "wrong-wrong-wrong" });
  assert.equal(bad.status, 401);
  assert.equal(bad.json.error, "Invalid email or password");
  assert.equal(bad.setCookie.length, 0);
  const unknown = await postJson(srv.base, "/api/auth/login", { email: "nobody@example.com", password: "wrong-wrong-wrong" });
  assert.equal(unknown.json.error, bad.json.error, "no user enumeration through the message");

  const good = await postJson(srv.base, "/api/auth/login", { email: s.email, password: PW });
  assert.equal(good.status, 200);
  const cookie2 = good.setCookie[0].split(";")[0];
  const csrf2 = good.json.csrfToken;

  const noCsrf = await postJson(srv.base, "/api/auth/logout", {}, { cookie: cookie2 });
  assert.equal(noCsrf.status, 403);
  assert.equal((await request(srv.base, { path: "/api/auth/me", headers: { cookie: cookie2 } })).status, 200, "failed logout must not end the session");
  const out = await postJson(srv.base, "/api/auth/logout", {}, { cookie: cookie2, "x-csrf-token": csrf2 });
  assert.equal(out.status, 200);
  assert.ok(out.setCookie.some((c) => /Max-Age=0/.test(c)));
  assert.equal((await request(srv.base, { path: "/api/auth/me", headers: { cookie: cookie2 } })).status, 401, "old cookie is dead server-side");

  for (let i = 0; i < 5; i++) await postJson(srv.base, "/api/auth/login", { email: s.email, password: "bad-guess-" + i });
  const locked = await postJson(srv.base, "/api/auth/login", { email: s.email, password: PW });
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers["retry-after"]) > 0);
});

test("body handling over the wire: malformed JSON → 400 JSON; auth bodies >16 KB → 413; protected bodies >2 MB → 413; never HTML or stack traces", async () => {
  const s = await signup(srv.base, "body");
  const malformed = await request(srv.base, { method: "POST", path: "/api/auth/login", headers: { "content-type": "application/json" }, body: "{bad" });
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers["content-type"] as string, /json/);
  assert.ok(!/at .*\.(ts|js):\d+|node_modules|\/home\//.test(malformed.text), "no stack/path leakage");
  const bigAuth = await request(srv.base, { method: "POST", path: "/api/auth/login", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a".repeat(20000) }) });
  assert.equal(bigAuth.status, 413);
  const bigProtected = await request(srv.base, { method: "POST", path: "/api/sql/execute", headers: authHeaders(s), body: JSON.stringify({ sql: "x".repeat(3 * 1024 * 1024) }) });
  assert.equal(bigProtected.status, 413);
  const nonObject = await request(srv.base, { method: "POST", path: "/api/auth/login", headers: { "content-type": "application/json" }, body: '"just a string"' });
  assert.equal(nonObject.status, 400, "strict JSON mode rejects non-object bodies");
  const deep = await postJson(srv.base, "/api/sql/execute", { sql: "SELECT 1; DROP TABLE users" }, authHeaders(s));
  assert.equal(deep.status, 400);
});

test("CORS over the wire: allowlisted origin gets exact-origin headers, others get none; cross-origin writes are rejected", async () => {
  const s = await signup(srv.base, "cors");
  const allowed = await request(srv.base, { method: "OPTIONS", path: "/api/agents/chat", headers: { origin: "https://ui.example.com", "access-control-request-method": "POST", "access-control-request-headers": "content-type,x-csrf-token" } });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers["access-control-allow-origin"], "https://ui.example.com");
  assert.equal(allowed.headers["access-control-allow-credentials"], "true");
  const evil = await request(srv.base, { method: "OPTIONS", path: "/api/agents/chat", headers: { origin: "https://evil.example", "access-control-request-method": "POST" } });
  assert.equal(evil.status, 403);
  assert.equal(evil.headers["access-control-allow-origin"], undefined);
  const getEvil = await request(srv.base, { path: "/api/health", headers: { origin: "https://evil.example" } });
  assert.equal(getEvil.headers["access-control-allow-origin"], undefined);
  const writeEvil = await postJson(srv.base, "/api/sql/execute", { sql: "SELECT 1" }, { ...authHeaders(s), origin: "https://evil.example" });
  assert.equal(writeEvil.status, 403, "valid cookie + valid CSRF token still cannot be used from a foreign Origin");
  const nullOrigin = await postJson(srv.base, "/api/sql/execute", { sql: "SELECT 1" }, { ...authHeaders(s), origin: "null" });
  assert.equal(nullOrigin.status, 403);
});

test("security headers on API responses and on the served HTML page (CSP included)", async () => {
  for (const p of ["/api/health", "/"]) {
    const r = await request(srv.base, { path: p });
    assert.equal(r.headers["x-content-type-options"], "nosniff", p);
    assert.equal(r.headers["x-frame-options"], "DENY", p);
    assert.match(String(r.headers["content-security-policy"]), /script-src 'self'/, p);
    assert.match(String(r.headers["strict-transport-security"]), /max-age=/, p);
    assert.equal(r.headers["x-powered-by"], undefined, p);
  }
  assert.equal((await request(srv.base, { path: "/api/health" })).headers["cache-control"], "no-store");
});

test("PERSISTENCE: sessions survive a full server process restart; nothing sensitive is stored in plaintext at rest", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-persist-"));
  let s1 = await startServer({ dataDir });
  const s = await signup(s1.base, "persist");
  assert.equal((await request(s1.base, { path: "/api/auth/me", headers: { cookie: s.cookie } })).status, 200);
  await s1.stop();

  const s2 = await startServer({ dataDir });
  try {
    const me = await request(s2.base, { path: "/api/auth/me", headers: { cookie: s.cookie } });
    assert.equal(me.status, 200, "session must survive restart (SQLite on persistent storage)");
    assert.equal(me.json.user.email, s.email);
    assert.equal(me.json.csrfToken, s.csrf);
    const login = await postJson(s2.base, "/api/auth/login", { email: s.email, password: PW });
    assert.equal(login.status, 200, "account must survive restart");
    assert.equal((await postJson(s2.base, "/api/sql/execute", { sql: "SELECT 1" }, { cookie: s.cookie, "x-csrf-token": s.csrf })).status, 200);
  } finally { await s2.stop(); }

  const files = fs.readdirSync(dataDir);
  assert.ok(files.includes("nexus.db"), `database file missing: ${files}`);
  const bytes = allFilesText(dataDir);
  assert.ok(!bytes.includes(PW), "plaintext password found on disk");
  assert.ok(!bytes.includes(s.rawToken), "raw session token found on disk (must be stored hashed)");
  assert.ok(bytes.includes("scrypt$"), "password must be stored as a scrypt hash");
});

test("rate limiting over HTTP: the LLM route answers 429 with Retry-After once the per-user limit is hit", async () => {
  const limited = await startServer({ env: { RATE_LLM_PER_MIN: "2" } });
  try {
    const s = await signup(limited.base, "rl");
    const call = () => postJson(limited.base, "/api/agents/chat", { role: "Planner", message: "hi" }, authHeaders(s));
    assert.notEqual((await call()).status, 429);
    assert.notEqual((await call()).status, 429);
    const third = await call();
    assert.equal(third.status, 429);
    assert.ok(Number(third.headers["retry-after"]) >= 1);
    assert.equal(third.headers["ratelimit-remaining"], "0");
  } finally { await limited.stop(); }
});
