import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PW = "a-sufficiently-long-passphrase";

export interface Server { port: number; base: string; dataDir: string; stop(): Promise<void>; child: ChildProcess }

async function freePort(): Promise<number> {
  const net = await import("node:net");
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = (s.address() as any).port; s.close(() => resolve(p)); });
    s.on("error", reject);
  });
}

/**
 * REAL EXPRESS MODE (E2E_REAL_EXPRESS=1, requires `npm install` and `npm run build`): runs `tsx server.ts` with the real
 * express package and polls /api/health. UNVERIFIED in the authoring sandbox (no npm registry access there).
 */
async function startRealExpress(opts: { env?: Record<string, string>; dataDir?: string }): Promise<Server> {
  const dataDir = opts.dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "nexus-e2e-real-"));
  const port = await freePort();
  const tsx = path.resolve("node_modules/.bin/tsx");
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: "production", DATA_DIR: dataDir, PORT: String(port), HOST: "127.0.0.1",
    RATE_LOGIN_PER_WINDOW: "1000", RATE_REGISTER_PER_HOUR: "1000", RATE_API_PER_MIN: "10000",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "AIza" + "T".repeat(35),
    ...(opts.env ?? {}),
  };
  const child = spawn(tsx, ["server.ts"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout!.on("data", (d) => { log += d.toString(); });
  child.stderr!.on("data", (d) => { log += d.toString(); });
  const deadline = Date.now() + 30000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`real server exited (${child.exitCode}): ${log}`);
    try { if ((await request(`http://127.0.0.1:${port}`, { path: "/api/health" })).status === 200) break; } catch { /* not up yet */ }
    if (Date.now() > deadline) { child.kill("SIGKILL"); throw new Error("real server did not become healthy: " + log); }
    await new Promise((r) => setTimeout(r, 200));
  }
  return {
    port, base: `http://127.0.0.1:${port}`, dataDir, child,
    stop: () => new Promise<void>((res) => { child.once("exit", () => res()); child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 5000).unref(); }),
  };
}

/** Spawns the REAL server.ts behind the HTTP bridge as a separate OS process. */
export async function startServer(opts: { env?: Record<string, string>; dataDir?: string; staticDir?: string } = {}): Promise<Server> {
  if (process.env.E2E_REAL_EXPRESS === "1") return startRealExpress(opts);
  const dataDir = opts.dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "nexus-e2e-"));
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: "production",
    DATA_DIR: dataDir,
    RATE_LOGIN_PER_WINDOW: "1000",
    RATE_REGISTER_PER_HOUR: "1000",
    RATE_API_PER_MIN: "10000",
    ...(opts.staticDir ? { STATIC_DIR: opts.staticDir } : {}),
    ...(opts.env ?? {}),
  };
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--import", "./tests/harness/register.mjs", "tests/e2e/shim-server.mjs"],
    { env, stdio: ["ignore", "pipe", "pipe"] }
  );
  let log = "";
  const port = await new Promise<number>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start: " + log)), 15000);
    const onData = (d: Buffer) => {
      log += d.toString();
      const m = /LISTENING (\d+)/.exec(log);
      if (m) { clearTimeout(t); resolve(Number(m[1])); }
    };
    child.stdout!.on("data", onData);
    child.stderr!.on("data", (d) => { log += d.toString(); });
    child.on("exit", (code) => { clearTimeout(t); reject(new Error(`server exited early (${code}): ${log}`)); });
  });
  return {
    port, base: `http://127.0.0.1:${port}`, dataDir, child,
    stop: () => new Promise<void>((res) => { child.removeAllListeners("exit"); child.once("exit", () => res()); child.kill("SIGTERM"); setTimeout(() => child.kill("SIGKILL"), 3000).unref(); }),
  };
}

export interface Reply { status: number; headers: http.IncomingHttpHeaders; setCookie: string[]; text: string; json: any }

/** Raw node:http client (full control over Origin/Host/Cookie headers, unlike fetch). */
export function request(base: string, o: { method?: string; path: string; headers?: Record<string, string>; body?: string | Buffer }): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const u = new URL(o.path, base);
    const headers: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.body !== undefined) headers["content-length"] = String(Buffer.byteLength(o.body));
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: o.method ?? "GET", headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json: any; try { json = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, setCookie: res.headers["set-cookie"] ?? [], text, json });
      });
    });
    req.on("error", reject);
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}

export const postJson = (base: string, p: string, body: unknown, headers: Record<string, string> = {}) =>
  request(base, { method: "POST", path: p, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

export interface Session { cookie: string; rawToken: string; csrf: string; email: string; base: string }

let n = 0;
export async function signup(base: string, tag = "u"): Promise<Session> {
  const email = `${tag}${++n}-${Date.now()}@example.com`;
  const r = await postJson(base, "/api/auth/register", { email, password: PW, displayName: tag });
  if (r.status !== 201) throw new Error(`signup failed ${r.status} ${r.text}`);
  const pair = r.setCookie[0].split(";")[0];
  return { cookie: pair, rawToken: decodeURIComponent(pair.split("=")[1]), csrf: r.json.csrfToken, email, base };
}

export const authHeaders = (s: Session, extra: Record<string, string> = {}) => ({
  cookie: s.cookie, "x-csrf-token": s.csrf, "content-type": "application/json", ...extra,
});

export function allFilesText(dir: string): string {
  return fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f)).toString("latin1")).join("\n");
}
