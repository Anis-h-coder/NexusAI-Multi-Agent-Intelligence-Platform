/**
 * Central, validated runtime configuration.
 * Reads environment variables once; fails fast on unsafe combinations.
 * Secrets (e.g. GEMINI_API_KEY) are intentionally NOT copied into this object.
 */
import path from "node:path";

export type SameSite = "lax" | "strict" | "none";

export interface AppConfig {
  nodeEnv: string;
  isProd: boolean;
  port: number;
  host: string;
  dataDir: string;
  allowedOrigins: string[];
  trustProxy: number | false;
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: SameSite;
  sessionTtlMs: number;
  sessionIdleMs: number;
  allowRegistration: boolean;
  maxJsonBytes: number;
  rateLimits: {
    apiPerMinute: number;
    llmPerMinute: number;
    loginPerWindow: number;
    loginWindowMs: number;
    registerPerHour: number;
  };
  llm: {
    dailyTokenBudget: number;
    maxOutputTokens: number;
    timeoutMs: number;
    models: string[];
  };
}

type Env = Record<string, string | undefined>;

function intFrom(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Invalid ${name}: expected an integer between ${min} and ${max}`);
  }
  return n;
}

function boolFrom(env: Env, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (/^(1|true|yes|on)$/i.test(raw)) return true;
  if (/^(0|false|no|off)$/i.test(raw)) return false;
  throw new Error(`Invalid ${name}: expected true/false`);
}

/** Normalises an origin string ("https://app.example.com/") to its canonical origin. */
export function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`Invalid origin in ALLOWED_ORIGINS: "${value}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Origin must be http(s): "${value}"`);
  }
  return url.origin;
}

export const DEFAULT_GEMINI_MODELS = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

export function loadConfig(env: Env = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";
  const onVercel = Boolean(env.VERCEL);

  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
  if (allowedOrigins.includes("*" as string)) throw new Error("Wildcard origins are not allowed");

  const cookieSecure = boolFrom(env, "COOKIE_SECURE", isProd);
  const sameSiteRaw = (env.COOKIE_SAMESITE || "lax").toLowerCase();
  if (!["lax", "strict", "none"].includes(sameSiteRaw)) {
    throw new Error("Invalid COOKIE_SAMESITE: expected lax, strict or none");
  }
  const cookieSameSite = sameSiteRaw as SameSite;
  if (cookieSameSite === "none" && !cookieSecure) {
    throw new Error("COOKIE_SAMESITE=none requires secure cookies (COOKIE_SECURE=true)");
  }

  const trustProxyHops = intFrom(env, "TRUST_PROXY", 0, 0, 10);

  const models = (env.GEMINI_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const m of models) {
    if (!/^[A-Za-z0-9._\-]{1,80}$/.test(m)) throw new Error("Invalid model id in GEMINI_MODELS");
  }

  return {
    nodeEnv,
    isProd,
    port: intFrom(env, "PORT", 3000, 1, 65535),
    host: env.HOST || "0.0.0.0",
    dataDir: path.resolve(env.DATA_DIR || (onVercel ? "/tmp/nexus-data" : "./data")),
    allowedOrigins,
    trustProxy: trustProxyHops > 0 ? trustProxyHops : false,
    // The __Host- prefix is only valid on Secure cookies without a Domain attribute.
    cookieName: cookieSecure ? "__Host-nexus_sid" : "nexus_sid",
    cookieSecure,
    cookieSameSite,
    sessionTtlMs: intFrom(env, "SESSION_TTL_HOURS", 24 * 7, 1, 24 * 90) * 3_600_000,
    sessionIdleMs: intFrom(env, "SESSION_IDLE_HOURS", 12, 1, 24 * 30) * 3_600_000,
    allowRegistration: boolFrom(env, "ALLOW_REGISTRATION", true),
    maxJsonBytes: intFrom(env, "MAX_JSON_BYTES", 2 * 1024 * 1024, 1024, 25 * 1024 * 1024),
    rateLimits: {
      apiPerMinute: intFrom(env, "RATE_API_PER_MIN", 120, 1, 100000),
      llmPerMinute: intFrom(env, "RATE_LLM_PER_MIN", 12, 1, 10000),
      loginPerWindow: intFrom(env, "RATE_LOGIN_PER_WINDOW", 10, 1, 1000),
      loginWindowMs: intFrom(env, "RATE_LOGIN_WINDOW_MIN", 15, 1, 1440) * 60_000,
      registerPerHour: intFrom(env, "RATE_REGISTER_PER_HOUR", 5, 1, 1000),
    },
    llm: {
      dailyTokenBudget: intFrom(env, "LLM_DAILY_TOKEN_BUDGET", 200_000, 1000, 100_000_000),
      maxOutputTokens: intFrom(env, "LLM_MAX_OUTPUT_TOKENS", 8192, 64, 65536),
      timeoutMs: intFrom(env, "LLM_TIMEOUT_MS", 60_000, 1000, 600_000),
      models: models.length > 0 ? models : DEFAULT_GEMINI_MODELS,
    },
  };
}
