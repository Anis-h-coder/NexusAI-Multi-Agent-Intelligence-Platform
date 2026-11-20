import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const TEST_GEMINI_KEY = "AIza" + "T".repeat(35);

/** Must run BEFORE server.ts is imported (config is read at import time). */
export function prepareEnv(extra: Record<string, string> = {}) {
  process.env.NODE_ENV = "production";
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-harness-"));
  process.env.GEMINI_API_KEY = TEST_GEMINI_KEY;
  delete process.env.VERCEL;
  for (const [k, v] of Object.entries(extra)) process.env[k] = v;
}

export interface CallOpts { method?: string; url: string; headers?: Record<string, string>; body?: any; ip?: string }
export interface Reply { status: number; body: any; headers: Record<string, any> }

export async function call(app: any, o: CallOpts): Promise<Reply> {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries({ host: "app.test", ...(o.headers ?? {}) })) headers[k.toLowerCase()] = v;
  const req: any = { method: o.method ?? "GET", originalUrl: o.url, url: o.url, headers, body: o.body ?? {}, ip: o.ip ?? "203.0.113.1" };
  const out: Reply & { ended: boolean } = { status: 200, body: undefined, headers: {}, ended: false };
  const res: any = {
    statusCode: 200,
    headersSent: false,
    setHeader(n: string, v: any) { out.headers[n.toLowerCase()] = v; },
    removeHeader(n: string) { delete out.headers[n.toLowerCase()]; },
    status(c: number) { res.statusCode = c; return res; },
    json(b: any) { out.body = b; out.ended = true; res.ended = true; res.headersSent = true; },
    end() { out.ended = true; res.ended = true; res.headersSent = true; },
    sendFile() { out.ended = true; res.ended = true; },
  };
  await app.handle(req, res);
  if (req.__unhandledRejections?.length) throw new Error("UNHANDLED ASYNC REJECTION in route: " + String(req.__unhandledRejections[0]?.message));
  return { status: res.statusCode, body: out.body, headers: out.headers };
}

export interface Session { cookie: string; csrf: string; email: string }

let counter = 0;
export async function signup(app: any, tag = "u", ip?: string): Promise<Session> {
  counter++;
  const email = `${tag}${counter}-${Date.now()}@example.com`;
  const r = await call(app, {
    method: "POST", url: "/api/auth/register",
    headers: { origin: "https://app.test" },
    body: { email, password: "a-sufficiently-long-passphrase", displayName: tag },
    ip: ip ?? `198.51.100.${counter % 250}`,
  });
  if (r.status !== 201) throw new Error(`signup failed: ${r.status} ${JSON.stringify(r.body)}`);
  const cookie = String(r.headers["set-cookie"]).split(";")[0];
  return { cookie, csrf: r.body.csrfToken, email };
}

export const authed = (s: Session, extra: Record<string, string> = {}) => ({
  cookie: s.cookie, "x-csrf-token": s.csrf, origin: "https://app.test", ...extra,
});

export function setGemini(handler: (args: any) => any) {
  (globalThis as any).__gemini = handler;
  (globalThis as any).__geminiCalls = [];
}
export const geminiCalls = (): any[] => (globalThis as any).__geminiCalls ?? [];
