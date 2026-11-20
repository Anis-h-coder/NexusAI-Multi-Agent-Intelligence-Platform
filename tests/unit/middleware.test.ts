import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../backend/config.ts";
import { openDatabase } from "../../backend/db/database.ts";
import { createAuditLog } from "../../backend/security/audit.ts";
import { createSessionService } from "../../backend/security/sessions.ts";
import { createAuthService } from "../../backend/security/auth-service.ts";
import { createAuthRoutes } from "../../backend/security/auth-routes.ts";
import {
  securityHeaders, cors, originCheck, requireCsrf, requireAuth, attachSession, parseCookies,
  sessionCookie, clearSessionCookie, errorHandler, apiNotFound, noStoreApi,
} from "../../backend/security/middleware.ts";
import { createRateLimiter } from "../../backend/security/ratelimit.ts";
import type { Req, Res, Middleware } from "../../backend/security/http-types.ts";

/* ---- tiny fake req/res + chain runner (no Express needed) ---- */
function mkReq(over: Partial<Req> = {}): Req {
  return { method: "GET", headers: { host: "app.local:3000" }, ip: "10.0.0.1", originalUrl: "/api/x", ...over } as Req;
}
function mkRes() {
  const headers: Record<string, any> = {};
  const res: any = {
    statusCode: 200, body: undefined, ended: false, headers,
    setHeader(n: string, v: any) { headers[n.toLowerCase()] = v; },
    removeHeader(n: string) { delete headers[n.toLowerCase()]; },
    status(c: number) { res.statusCode = c; return res; },
    json(b: any) { res.body = b; res.ended = true; },
    end() { res.ended = true; },
  };
  return res as Res & { body: any; ended: boolean; headers: Record<string, any> };
}
async function run(chain: Middleware[], req: Req, res = mkRes()) {
  let reachedEnd = false;
  const step = async (i: number): Promise<void> => {
    if (res.ended) return;
    if (i === chain.length) { reachedEnd = true; return; }
    let nextCalled = false;
    await chain[i](req, res, (err) => { if (err) throw err; nextCalled = true; });
    if (nextCalled) await step(i + 1);
  };
  await step(0);
  return { res, reachedEnd };
}

const prodCfg = loadConfig({ NODE_ENV: "production", ALLOWED_ORIGINS: "https://ui.example.com" });
const devCfg = loadConfig({ NODE_ENV: "development" });

test("config: safe defaults and fail-fast validation", () => {
  assert.equal(prodCfg.cookieSecure, true);
  assert.equal(prodCfg.cookieName, "__Host-nexus_sid");
  assert.equal(devCfg.cookieSecure, false);
  assert.equal(devCfg.cookieName, "nexus_sid");
  assert.deepEqual(prodCfg.allowedOrigins, ["https://ui.example.com"]);
  assert.throws(() => loadConfig({ ALLOWED_ORIGINS: "*" }), /Invalid origin/);
  assert.throws(() => loadConfig({ ALLOWED_ORIGINS: "javascript:alert(1)" }), /must be http/);
  assert.throws(() => loadConfig({ COOKIE_SAMESITE: "none", COOKIE_SECURE: "false" }), /requires secure/);
  assert.throws(() => loadConfig({ PORT: "99999" }), /PORT/);
  assert.throws(() => loadConfig({ GEMINI_MODELS: "bad model;rm" }), /model id/);
  assert.equal(prodCfg.maxJsonBytes, 2 * 1024 * 1024, "default body cap is 2 MiB, not 25 MiB");
});

test("security headers: CSP+HSTS only in production; nosniff/frame/referrer always; request id set", async () => {
  const { res: p } = await run([securityHeaders(prodCfg)], mkReq());
  assert.match(String(p.headers["content-security-policy"]), /default-src 'self'/);
  assert.match(String(p.headers["content-security-policy"]), /frame-ancestors 'none'/);
  assert.match(String(p.headers["content-security-policy"]), /object-src 'none'/);
  assert.ok(p.headers["strict-transport-security"]);
  assert.equal(p.headers["x-content-type-options"], "nosniff");
  assert.equal(p.headers["x-frame-options"], "DENY");
  assert.equal(p.headers["referrer-policy"], "no-referrer");
  assert.ok(p.headers["x-request-id"]);
  assert.equal(p.headers["x-powered-by"], undefined);
  const { res: d } = await run([securityHeaders(devCfg)], mkReq());
  assert.equal(d.headers["content-security-policy"], undefined, "dev must not set CSP (breaks Vite HMR)");
  const { res: n } = await run([noStoreApi], mkReq());
  assert.equal(n.headers["cache-control"], "no-store");
});

test("CORS: strict allowlist, never wildcard, credentials only for allowed origins", async () => {
  const ok = await run([cors(prodCfg)], mkReq({ headers: { host: "api.example.com", origin: "https://ui.example.com" } }));
  assert.equal(ok.res.headers["access-control-allow-origin"], "https://ui.example.com");
  assert.equal(ok.res.headers["access-control-allow-credentials"], "true");
  assert.equal(ok.reachedEnd, true);

  const evil = await run([cors(prodCfg)], mkReq({ headers: { host: "api.example.com", origin: "https://evil.example" } }));
  assert.equal(evil.res.headers["access-control-allow-origin"], undefined);
  assert.equal(evil.res.headers["access-control-allow-credentials"], undefined);

  const pre = await run([cors(prodCfg)], mkReq({ method: "OPTIONS", headers: { host: "api.example.com", origin: "https://ui.example.com", "access-control-request-method": "POST" } }));
  assert.equal(pre.res.statusCode, 204);
  assert.equal(pre.res.headers["access-control-allow-headers"], "Content-Type, X-CSRF-Token");

  const badPre = await run([cors(prodCfg)], mkReq({ method: "OPTIONS", headers: { host: "api.example.com", origin: "https://evil.example", "access-control-request-method": "POST" } }));
  assert.equal(badPre.res.statusCode, 403);
  assert.equal(badPre.res.headers["access-control-allow-origin"], undefined);

  for (const origin of ["https://ui.example.com", "https://evil.example", undefined]) {
    const r = await run([cors(prodCfg)], mkReq({ headers: { host: "api.example.com", ...(origin ? { origin } : {}) } }));
    assert.notEqual(r.res.headers["access-control-allow-origin"], "*");
  }
});

test("origin check: cross-site writes rejected; same-origin, allow-listed and non-browser pass", async () => {
  const mw = originCheck(prodCfg);
  const post = (headers: Record<string, string>) => run([mw], mkReq({ method: "POST", headers: { host: "app.local:3000", ...headers } }));
  assert.equal((await post({ origin: "https://evil.example" })).res.statusCode, 403);
  assert.equal((await post({ origin: "null" })).res.statusCode, 403);
  assert.equal((await post({ "sec-fetch-site": "cross-site" })).res.statusCode, 403);
  assert.equal((await post({ origin: "http://app.local:3000" })).reachedEnd, true);
  assert.equal((await post({ origin: "https://ui.example.com" })).reachedEnd, true);
  assert.equal((await post({})).reachedEnd, true, "non-browser clients proceed to the CSRF-token check");
  const get = await run([mw], mkReq({ method: "GET", headers: { host: "app.local:3000", origin: "https://evil.example" } }));
  assert.equal(get.reachedEnd, true, "safe methods are not blocked");
});

test("cookies: attributes, parsing, and clearing", () => {
  const c = sessionCookie(prodCfg, "tok123", 3_600_000);
  assert.match(c, /^__Host-nexus_sid=tok123;/);
  for (const a of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=3600"]) assert.ok(c.includes(a), a);
  assert.ok(!c.includes("Domain="), "__Host- cookies must not set Domain");
  const dev = sessionCookie(devCfg, "t", 1000);
  assert.ok(!dev.includes("Secure"));
  assert.ok(dev.includes("HttpOnly"));
  assert.match(clearSessionCookie(prodCfg), /Max-Age=0/);
  assert.deepEqual({ ...parseCookies("a=1; b=%20x; c") }, { a: "1", b: " x" });
  const polluted = parseCookies("__proto__=evil; a=1");
  assert.equal(Object.getPrototypeOf(polluted), null, "cookie map must have no prototype");
  assert.equal(({} as any).evil, undefined, "Object.prototype must not be polluted");
  assert.equal(polluted.a, "1");
  assert.equal(Object.keys(parseCookies("x".repeat(5000))).length, 0);
});

test("rate limiter: blocks after max, sets headers, resets after window, bounds memory", async () => {
  let t = 0;
  const rl = createRateLimiter({ name: "t", windowMs: 1000, max: 3, now: () => t, maxKeys: 5 });
  for (let i = 0; i < 3; i++) assert.equal((await run([rl], mkReq())).reachedEnd, true);
  const blocked = await run([rl], mkReq());
  assert.equal(blocked.res.statusCode, 429);
  assert.ok(Number(blocked.res.headers["retry-after"]) >= 1);
  assert.equal(blocked.res.headers["ratelimit-remaining"], 0);
  assert.equal((await run([rl], mkReq({ ip: "10.0.0.2" }))).reachedEnd, true, "other keys unaffected");
  t = 1500;
  assert.equal((await run([rl], mkReq())).reachedEnd, true, "window resets");
  for (let i = 0; i < 50; i++) await run([rl], mkReq({ ip: `9.9.9.${i}` }));
  assert.ok(rl.size() <= 5, `key map must stay bounded, got ${rl.size()}`);
});

test("error handler never leaks internals; maps body-parser errors", async () => {
  const logs: string[] = [];
  const eh = errorHandler((m) => logs.push(m));
  const call = (err: any) => { const res = mkRes(); eh(err, mkReq({ id: "rid1" }), res, () => {}); return res; };
  const boom = call(Object.assign(new Error("SQLITE_ERROR: /srv/app/data/nexus.db secret=AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE12"), { stack: "at /srv/app/x.ts:1" }));
  assert.equal(boom.statusCode, 500);
  assert.equal(JSON.stringify(boom.body).includes("SQLITE"), false);
  assert.equal(JSON.stringify(boom.body).includes("/srv"), false);
  assert.equal(boom.body.requestId, "rid1");
  assert.equal(call({ type: "entity.too.large", status: 413 }).statusCode, 413);
  assert.equal(call({ type: "entity.parse.failed", status: 400 }).statusCode, 400);
  assert.equal(logs.length, 1, "only 5xx are logged");
  const nf = mkRes(); apiNotFound(mkReq(), nf, () => {});
  assert.equal(nf.statusCode, 404);
  assert.equal(typeof nf.body.error, "string");
});

/* ---- full auth flow through the real handlers + middleware chain ---- */
function build() {
  const cfg = loadConfig({ NODE_ENV: "development" });
  const db = openDatabase("", ":memory:");
  const audit = createAuditLog(db);
  const sessions = createSessionService(db, { ttlMs: cfg.sessionTtlMs, idleMs: cfg.sessionIdleMs });
  const auth = createAuthService(db, audit);
  const routes = createAuthRoutes({ config: cfg, auth, sessions, geminiConfigured: () => false });
  return { cfg, db, sessions, routes };
}
const PW = "a-sufficiently-long-passphrase";

test("auth flow: register sets HttpOnly cookie, me works, csrf enforced, logout revokes, fixation prevented", async () => {
  const { cfg, db, sessions, routes } = build();
  const reg = mkRes();
  await routes.register(mkReq({ method: "POST", body: { email: "a@example.com", password: PW, displayName: "A" } }), reg);
  assert.equal(reg.statusCode, 201);
  assert.ok(reg.body.csrfToken);
  assert.equal(reg.body.user.email, "a@example.com");
  assert.equal(JSON.stringify(reg.body).includes("password"), false, "no password/hash in responses");
  const setCookie = String(reg.headers["set-cookie"]);
  assert.match(setCookie, /HttpOnly/);
  const token = decodeURIComponent(setCookie.split(";")[0].split("=")[1]);

  const authed = (over: Partial<Req> = {}) => mkReq({ headers: { host: "app.local:3000", cookie: `${cfg.cookieName}=${encodeURIComponent(token)}`, ...(over.headers ?? {}) }, ...over, });
  const chain = [attachSession(cfg, sessions), requireAuth, requireCsrf];

  const me = mkRes();
  routes.me(Object.assign(authed(), { auth: sessions.validate(token)! }), me);
  assert.equal(me.statusCode, 200);
  assert.equal(me.body.user.email, "a@example.com");
  assert.equal(me.body.csrfToken, reg.body.csrfToken);

  assert.equal((await run(chain, authed({ method: "GET" }))).reachedEnd, true, "GET needs no csrf token");
  assert.equal((await run(chain, authed({ method: "POST" }))).res.statusCode, 403, "POST without csrf token");
  assert.equal((await run(chain, authed({ method: "POST", headers: { host: "app.local:3000", cookie: `${cfg.cookieName}=${encodeURIComponent(token)}`, "x-csrf-token": "wrong" } }))).res.statusCode, 403);
  assert.equal((await run(chain, authed({ method: "POST", headers: { host: "app.local:3000", cookie: `${cfg.cookieName}=${encodeURIComponent(token)}`, "x-csrf-token": reg.body.csrfToken } }))).reachedEnd, true);
  assert.equal((await run(chain, mkReq({ method: "GET" }))).res.statusCode, 401, "no cookie → 401");

  // Fixation: logging in while presenting an old cookie retires that session and issues a new token.
  const login = mkRes();
  await routes.login(authed({ method: "POST", body: { email: "a@example.com", password: PW } }), login);
  assert.equal(login.statusCode, 200);
  const token2 = decodeURIComponent(String(login.headers["set-cookie"]).split(";")[0].split("=")[1]);
  assert.notEqual(token2, token);
  assert.equal(sessions.validate(token), null, "old session must be revoked");

  const out = mkRes();
  routes.logout(authed({ method: "POST", headers: { host: "app.local:3000", cookie: `${cfg.cookieName}=${encodeURIComponent(token2)}` } }), out);
  assert.equal(sessions.validate(token2), null);
  assert.match(String(out.headers["set-cookie"]), /Max-Age=0/);
  const rows = db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number };
  assert.equal(rows.n, 0);
});

test("auth routes: bad credentials → generic 401; registration can be disabled; invalid cookie is cleared", async () => {
  const { cfg, sessions, routes } = build();
  const r = mkRes();
  await routes.login(mkReq({ method: "POST", body: { email: "ghost@example.com", password: "whatever-whatever" } }), r);
  assert.equal(r.statusCode, 401);
  assert.equal(r.body.error, "Invalid email or password");
  const off = createAuthRoutes({ config: { ...cfg, allowRegistration: false }, auth: null as any, sessions, geminiConfigured: () => false });
  const d = mkRes(); await off.register(mkReq({ method: "POST", body: {} }), d);
  assert.equal(d.statusCode, 403);
  const bad = await run([attachSession(cfg, sessions)], mkReq({ headers: { host: "x", cookie: `${cfg.cookieName}=${"z".repeat(43)}` } }));
  assert.match(String(bad.res.headers["set-cookie"]), /Max-Age=0/);
});
