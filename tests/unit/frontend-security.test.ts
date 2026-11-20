/** Static regression guards over the frontend source. They fail if a previously-fixed weakness is reintroduced. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk("src").map((f) => ({ f, text: fs.readFileSync(f, "utf8") }));
const offenders = (re: RegExp, except: (f: string) => boolean = () => false) =>
  files.filter(({ f, text }) => !except(f) && re.test(text)).map(({ f }) => f);

test("no hardcoded JWT / credential-shaped tokens or API keys in the client bundle source", () => {
  assert.deepEqual(offenders(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/), []);
  assert.deepEqual(offenders(/AIza[0-9A-Za-z_-]{35}|\bsk-[A-Za-z0-9]{20,}/), []);
  assert.deepEqual(offenders(/jwtToken/), []);
});

test("no hardcoded user identity (CURRENT_USER) or personal email addresses in source", () => {
  assert.deepEqual(offenders(/CURRENT_USER/), []);
  assert.deepEqual(offenders(/fanish050@/), []);
});

test("all /api calls go through safeFetchJson (credentials + CSRF), never a raw fetch", () => {
  assert.deepEqual(offenders(/\bfetch\(\s*['"`]\/api/, (f) => f.endsWith("apiClient.ts")), []);
});

test("no unsafe DOM sinks; no tokens/sessions persisted in web storage", () => {
  assert.deepEqual(offenders(/dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\(|\beval\(|new Function\(/), []);
  assert.deepEqual(offenders(/(localStorage|sessionStorage)\.setItem\([^)]*(token|csrf|jwt|session|password)/i), []);
});

test("the CSRF token stays in memory (apiClient) and is never written to storage or the DOM", () => {
  const raw = files.find(({ f }) => f.endsWith("apiClient.ts"))!.text;
  const client = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"); // code only, comments ignored
  assert.match(client, /let csrfToken/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|document\.cookie/);
});

test("session gate: App renders the workspace only after the server confirms a session", () => {
  const app = fs.readFileSync("src/App.tsx", "utf8");
  assert.match(app, /fetchSession\(\)/);
  assert.match(app, /status === 'anonymous'/);
  assert.match(app, /<AuthScreen/);
  assert.match(app, /onUnauthorized\(/);
});

test("REGRESSION: the Vercel entry never sets wildcard CORS (S4) and the legacy entry keeps URL restoration", () => {
  const api = fs.readFileSync("api/index.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(api, /Access-Control-Allow-Origin/i);
  assert.doesNotMatch(api, /Allow-Credentials/i);
  assert.match(api, /x-forwarded-uri/);
});

test("REGRESSION: runtime data is git-ignored; env example documents security settings without secret values", () => {
  const ig = fs.readFileSync(".gitignore", "utf8");
  assert.match(ig, /^data\/$/m);
  assert.match(ig, /^\*\.db$/m);
  const env = fs.readFileSync(".env.example", "utf8");
  assert.doesNotMatch(env, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(env, /ALLOWED_ORIGINS=\s*$/m);
});
