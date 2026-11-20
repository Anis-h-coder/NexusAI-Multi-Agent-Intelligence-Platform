import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.ts";
import type { Middleware, Req, Res } from "./http-types.ts";
import { header, isUnsafeMethod } from "./http-types.ts";
import type { SessionService } from "./sessions.ts";
import { safeEqual } from "./sessions.ts";

/* ---------------------------------------------------------------- headers */

export const CSP_PRODUCTION = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Tailwind/React inline style attributes
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Request id + hardening headers. CSP is production-only because Vite's dev server needs inline scripts/websockets. */
export function securityHeaders(config: AppConfig): Middleware {
  return (req, res, next) => {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    res.removeHeader?.("X-Powered-By");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (config.isProd) {
      res.setHeader("Content-Security-Policy", CSP_PRODUCTION);
      if (config.cookieSecure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  };
}

/** Responses from /api must never be cached by browsers or shared proxies. */
export const noStoreApi: Middleware = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

/* ------------------------------------------------------------------- CORS */

function requestHost(req: Req): string | undefined {
  return header(req, "host")?.toLowerCase();
}

export function isSameOrigin(req: Req, origin: string): boolean {
  try {
    return new URL(origin).host.toLowerCase() === requestHost(req);
  } catch {
    return false;
  }
}

/** Strict allowlist CORS. Same-origin needs no CORS headers; unknown origins never receive Access-Control-Allow-*. */
export function cors(config: AppConfig): Middleware {
  const allowed = new Set(config.allowedOrigins);
  return (req, res, next) => {
    const origin = header(req, "origin");
    if (!origin) return next();
    const isPreflight = req.method === "OPTIONS" && Boolean(header(req, "access-control-request-method"));
    if (allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      if (isPreflight) {
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
        res.setHeader("Access-Control-Max-Age", "600");
        res.status(204).end();
        return;
      }
      return next();
    }
    if (isPreflight && !isSameOrigin(req, origin)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    res.setHeader("Vary", "Origin");
    next();
  };
}

/* ------------------------------------------------- CSRF: origin + token */

/**
 * Defence in depth for state-changing requests:
 *  1. If the browser sent an Origin, it must be same-origin or allow-listed ("null" is rejected).
 *  2. Otherwise Sec-Fetch-Site must not be "cross-site".
 * Non-browser clients (no Origin / Sec-Fetch-Site) pass this step but still need the CSRF token on authed routes.
 */
export function originCheck(config: AppConfig): Middleware {
  const allowed = new Set(config.allowedOrigins);
  return (req, res, next) => {
    if (!isUnsafeMethod(req.method)) return next();
    const origin = header(req, "origin");
    if (origin !== undefined) {
      if (origin === "null" || !(allowed.has(origin) || isSameOrigin(req, origin))) {
        res.status(403).json({ error: "Cross-origin request rejected" });
        return;
      }
      return next();
    }
    if (header(req, "sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Cross-site request rejected" });
      return;
    }
    next();
  };
}

/** Requires the per-session CSRF token on unsafe methods. Must run after requireAuth. */
export const requireCsrf: Middleware = (req, res, next) => {
  if (!isUnsafeMethod(req.method)) return next();
  const sent = header(req, "x-csrf-token");
  if (!req.auth || !sent || !safeEqual(sent, req.auth.csrfToken)) {
    res.status(403).json({ error: "Missing or invalid CSRF token" });
    return;
  }
  next();
};

/* ---------------------------------------------------------------- cookies */

export function parseCookies(headerValue: string | undefined): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  if (!headerValue || headerValue.length > 4096) return out;
  for (const part of headerValue.split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    let value = part.slice(i + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!(name in out)) {
      try { out[name] = decodeURIComponent(value); } catch { /* ignore malformed */ }
    }
  }
  return out;
}

function cookieAttrs(config: AppConfig): string[] {
  const ss = config.cookieSameSite;
  const attrs = ["Path=/", "HttpOnly", `SameSite=${ss[0].toUpperCase()}${ss.slice(1)}`];
  if (config.cookieSecure) attrs.push("Secure");
  return attrs;
}

export function sessionCookie(config: AppConfig, token: string, maxAgeMs: number): string {
  return [`${config.cookieName}=${encodeURIComponent(token)}`, ...cookieAttrs(config), `Max-Age=${Math.floor(maxAgeMs / 1000)}`].join("; ");
}

export function clearSessionCookie(config: AppConfig): string {
  return [`${config.cookieName}=`, ...cookieAttrs(config), "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"].join("; ");
}

/** Loads req.auth from the session cookie when valid; never rejects by itself. */
export function attachSession(config: AppConfig, sessions: SessionService): Middleware {
  return (req, res, next) => {
    const token = parseCookies(header(req, "cookie"))[config.cookieName];
    if (token) {
      const auth = sessions.validate(token);
      if (auth) req.auth = auth;
      else res.setHeader("Set-Cookie", clearSessionCookie(config));
    }
    next();
  };
}

export const requireAuth: Middleware = (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

/* ------------------------------------------------------------ error paths */

export const apiNotFound: Middleware = (req, res) => {
  res.status(404).json({ error: "Not found" });
};

/**
 * Express error handler. Never leaks stack traces, SQL, file paths or upstream error text.
 * (4-arg signature is required by Express to recognise it as an error handler.)
 */
export function errorHandler(log: (msg: string) => void = console.error) {
  return (err: any, req: Req, res: Res, next: (e?: unknown) => void) => {
    if (res.headersSent) return next(err);
    const status = Number(err?.status ?? err?.statusCode);
    let code = 500;
    let message = "Internal server error";
    if (err?.type === "entity.too.large" || status === 413) { code = 413; message = "Request body too large"; }
    else if (err?.type === "entity.parse.failed" || err?.type === "encoding.unsupported" || err?.type === "charset.unsupported") { code = 400; message = "Invalid request body"; }
    else if (status >= 400 && status < 500) { code = status; message = "Request could not be processed"; }
    if (code >= 500) log(`[${req.id ?? "-"}] ${req.method} ${(req.originalUrl ?? req.url ?? "").split("?")[0]} -> ${err?.name ?? "Error"}: ${String(err?.message ?? err).slice(0, 300)}`);
    res.status(code).json({ error: message, requestId: req.id });
  };
}
