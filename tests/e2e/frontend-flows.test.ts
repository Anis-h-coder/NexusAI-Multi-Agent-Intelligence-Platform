/**
 * REAL-BROWSER tests (Chromium) of the real React app (App.tsx, AuthScreen, Navbar, apiClient, auth utils) against the
 * real server.ts running over real HTTP in a separate process. Stubbed: lucide/recharts/markdown/jspdf (inert), Tailwind CSS
 * is not processed, and Express internals are the harness's. This is NOT the production Vite build.
 * Env: PLAYWRIGHT_MODULE (default "playwright"), ESBUILD_MODULE, E2E_NODE_PATH (offline resolution).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { startServer, request, type Server } from "./helpers.ts";
// @ts-ignore - plain ESM helper
import { buildBundle } from "./build-bundle.mjs";

const PW = "a-sufficiently-long-passphrase";
let srv: Server;
let browser: any;
let pwLib: any;
let origin: string;
const pageErrors: string[] = [];

before(async () => {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-e2e-static-"));
  await buildBundle(staticDir);
  pwLib = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
  const { chromium } = pwLib.default ?? pwLib;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  srv = await startServer({ staticDir });
  origin = srv.base; // http://127.0.0.1:<port>
});
after(async () => { await browser?.close(); await srv?.stop(); });

async function newPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (r: any) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api")) requests.push(`${r.method()} ${u.pathname}`); });
  page.on("pageerror", (e: Error) => pageErrors.push(e.message));
  return { context, page, requests };
}
const heading = (page: any) => page.getByRole("heading", { name: /Sign in to your workspace|Create your account/ });
const signOutBtn = (page: any) => page.getByRole("button", { name: "Sign out" });
async function register(page: any, email: string, password = PW) {
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("anonymous visit: only the sign-in screen is rendered and the ONLY API call is /api/auth/me", async () => {
  const { page, requests, context } = await newPage();
  await page.goto(origin);
  await heading(page).waitFor({ timeout: 15000 });
  assert.match(await heading(page).innerText(), /Sign in to your workspace/);
  await page.waitForTimeout(500);
  assert.deepEqual([...new Set(requests)], ["GET /api/auth/me"], `unexpected API traffic before login: ${requests}`);
  assert.equal(await signOutBtn(page).count(), 0, "no workspace chrome for anonymous users");
  await context.close();
});

test("registration: weak password is rejected with the server's message; valid registration opens the workspace", async () => {
  const { page, context } = await newPage();
  await page.goto(origin);
  await heading(page).waitFor();
  await register(page, `weak-${Date.now()}@example.com`, "short");
  const alert = page.getByRole("alert");
  await alert.waitFor();
  assert.match(await alert.innerText(), /at least 10 characters/i);
  assert.equal(await signOutBtn(page).count(), 0, "still signed out");

  const email = `e2e-${Date.now()}@example.com`;
  await page.getByLabel("Password", { exact: true }).fill(PW);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account" }).click();
  await signOutBtn(page).waitFor({ timeout: 15000 });
  assert.ok((await page.content()).includes(email), "the signed-in user's email is displayed in the Navbar");

  const cookies = await context.cookies();
  const sid = cookies.find((c: any) => c.name === "__Host-nexus_sid");
  assert.ok(sid, `session cookie not stored by the browser: ${JSON.stringify(cookies.map((c: any) => c.name))}`);
  assert.equal(sid.httpOnly, true);
  assert.equal(sid.secure, true);
  assert.equal(sid.sameSite, "Lax");
  assert.equal(sid.path, "/");
  assert.ok(!(await page.evaluate(() => document.cookie)).includes("nexus_sid"), "session cookie must not be readable from JavaScript");
  await context.close();
});

test("reload keeps the session; CSRF token is re-issued in memory; protected calls work through the app's client but not as raw fetch", async () => {
  const { page, context, requests } = await newPage();
  await page.goto(origin);
  await heading(page).waitFor();
  await register(page, `reload-${Date.now()}@example.com`);
  await signOutBtn(page).waitFor();

  await page.reload();
  await signOutBtn(page).waitFor({ timeout: 15000 });
  assert.equal(await heading(page).count(), 0, "no flash of the login screen after reload with a valid session");

  const viaClient = await page.evaluate(async () => {
    const r = await (window as any).__api.safeFetchJson("/api/sql/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: "SELECT 1" }) });
    return { ok: r.ok, status: r.status };
  });
  assert.deepEqual(viaClient, { ok: true, status: 200 });

  const rawNoCsrf = await page.evaluate(async () => (await fetch("/api/sql/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: "SELECT 1" }) })).status);
  assert.equal(rawNoCsrf, 403, "cookie alone is not enough: CSRF token is required");

  const dangerous = await page.evaluate(async () => (await (window as any).__api.safeFetchJson("/api/sql/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: "DROP TABLE users" }) })).status);
  assert.equal(dangerous, 400);
  assert.ok(requests.includes("GET /api/auth/me"));
  await context.close();
});

test("logout button ends the session server-side; reload stays signed out; replaying the old cookie fails", async () => {
  const { page, context } = await newPage();
  await page.goto(origin);
  await heading(page).waitFor();
  await register(page, `logout-${Date.now()}@example.com`);
  await signOutBtn(page).waitFor();
  const cookie = (await context.cookies()).find((c: any) => c.name === "__Host-nexus_sid")!;

  await signOutBtn(page).click();
  await heading(page).waitFor({ timeout: 15000 });
  await page.reload();
  await heading(page).waitFor();
  assert.equal(await signOutBtn(page).count(), 0);

  const replay = await request(origin, { path: "/api/auth/me", headers: { cookie: `${cookie.name}=${cookie.value}` } });
  assert.equal(replay.status, 401, "a copied session cookie must be dead after logout");
  await context.close();
});

test("login: wrong password shows a generic error and stays signed out; correct password signs in", async () => {
  const email = `login-${Date.now()}@example.com`;
  const seed = await newPage();
  await seed.page.goto(origin); await heading(seed.page).waitFor();
  await register(seed.page, email); await signOutBtn(seed.page).waitFor();
  await signOutBtn(seed.page).click(); await heading(seed.page).waitFor();
  await seed.context.close();

  const { page, context } = await newPage();
  await page.goto(origin); await heading(page).waitFor();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  const alert = page.getByRole("alert"); await alert.waitFor();
  assert.match(await alert.innerText(), /Invalid email or password/);
  assert.equal(await signOutBtn(page).count(), 0);
  await page.getByLabel("Password", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await signOutBtn(page).waitFor({ timeout: 15000 });
  await context.close();
});

test("expired/revoked session: the next protected call (401) sends the user back to sign-in without a reload", async () => {
  const { page, context } = await newPage();
  await page.goto(origin); await heading(page).waitFor();
  await register(page, `expire-${Date.now()}@example.com`);
  await signOutBtn(page).waitFor();

  const db = new DatabaseSync(path.join(srv.dataDir, "nexus.db"));
  db.exec("PRAGMA busy_timeout = 5000");
  const removed = db.prepare("DELETE FROM sessions").run();
  db.close();
  assert.ok(Number(removed.changes) >= 1);

  const status = await page.evaluate(async () => (await (window as any).__api.safeFetchJson("/api/sql/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: "SELECT 1" }) })).status);
  assert.equal(status, 401);
  await heading(page).waitFor({ timeout: 15000 });
  assert.equal(await signOutBtn(page).count(), 0, "workspace must be torn down when the session dies");
  await context.close();
});

test("CSRF attack from a foreign site: cross-origin reads are blocked and a forged logout form cannot end the victim's session", async () => {
  const { page: victim, context } = await newPage();
  await victim.goto(origin); await heading(victim).waitFor();
  await register(victim, `victim-${Date.now()}@example.com`);
  await signOutBtn(victim).waitFor();
  const cookie = (await context.cookies()).find((c: any) => c.name === "__Host-nexus_sid")!;
  const cookieHeader = `${cookie.name}=${cookie.value}`;

  // Attacker page on a different site (localhost vs 127.0.0.1), opened in the SAME browser profile as the victim.
  const attacker = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><body><script>
      fetch(${JSON.stringify(origin)} + "/api/auth/me", { credentials: "include" })
        .then(r => r.text().then(t => window.__read = "READ:" + r.status + ":" + t))
        .catch(e => window.__read = "BLOCKED:" + e.name);
    </script>
    <form id="f" method="post" action="${origin}/api/auth/logout"></form></body>`);
  });
  await new Promise<void>((r) => attacker.listen(0, "127.0.0.1", r));
  const attackerUrl = `http://localhost:${(attacker.address() as any).port}/`;
  try {
    const evil = await context.newPage();
    await evil.goto(attackerUrl);
    await evil.waitForFunction(() => (window as any).__read !== undefined, null, { timeout: 10000 });
    const read = await evil.evaluate(() => (window as any).__read);
    assert.match(read, /^BLOCKED:/, `attacker must not be able to read the API response, got: ${read}`);

    const [resp] = await Promise.all([
      evil.waitForResponse((r: any) => r.url().endsWith("/api/auth/logout")),
      evil.evaluate(() => (document.getElementById("f") as HTMLFormElement).submit()),
    ]);
    assert.ok([401, 403].includes(resp.status()), `forged logout must be refused, got ${resp.status()}`);
  } finally { attacker.close(); }

  const stillAlive = await request(origin, { path: "/api/auth/me", headers: { cookie: cookieHeader } });
  assert.equal(stillAlive.status, 200, "the victim's session must survive the forged request");
  await victim.reload();
  await signOutBtn(victim).waitFor({ timeout: 15000 });
  await context.close();
});

test("CSP is enforced by the browser: an injected inline script does not run", async () => {
  const { page, context } = await newPage();
  const violations: string[] = [];
  page.on("console", (m: any) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
  await page.goto(origin); await heading(page).waitFor();
  await page.evaluate(() => { const s = document.createElement("script"); s.textContent = "window.__xss = 1"; document.body.appendChild(s); });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => (window as any).__xss), undefined, "inline script executed: CSP not effective");
  assert.ok(violations.length >= 1, "browser should report a CSP violation");
  await context.close();
});

test("no uncaught JavaScript errors occurred in any flow (stub artefacts would appear here)", () => {
  assert.deepEqual(pageErrors, []);
});
