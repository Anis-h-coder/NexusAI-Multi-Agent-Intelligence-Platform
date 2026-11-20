/** Framework-agnostic handlers for /api/auth/*. Registered by server.ts. */
import type { AppConfig } from "../config.ts";
import type { AuthService } from "./auth-service.ts";
import { AuthError } from "./auth-service.ts";
import type { SessionService } from "./sessions.ts";
import { parseCookies, sessionCookie, clearSessionCookie } from "./middleware.ts";
import { header, type Req, type Res } from "./http-types.ts";

export function createAuthRoutes(deps: { config: AppConfig; auth: AuthService; sessions: SessionService; geminiConfigured: () => boolean }) {
  const { config, auth, sessions } = deps;

  const sendError = (res: Res, err: unknown) => {
    if (err instanceof AuthError) {
      if (err.retryAfterSec) res.setHeader("Retry-After", err.retryAfterSec);
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  };

  const startSession = (req: Req, res: Res, user: { id: string; email: string; displayName: string; role: string }, status: number) => {
    // Always issue a brand-new session (prevents session fixation) and retire any presented one.
    const old = parseCookies(header(req, "cookie"))[config.cookieName];
    if (old) sessions.destroy(old);
    const s = sessions.create(user.id, { ip: req.ip, userAgent: header(req, "user-agent") });
    res.setHeader("Set-Cookie", sessionCookie(config, s.token, config.sessionTtlMs));
    res.status(status).json({ user, csrfToken: s.csrfToken, geminiConfigured: deps.geminiConfigured() });
  };

  return {
    async register(req: Req, res: Res) {
      if (!config.allowRegistration) {
        res.status(403).json({ error: "Registration is disabled on this server" });
        return;
      }
      try {
        const user = await auth.register(req.body, req.ip);
        startSession(req, res, user, 201);
      } catch (err) { sendError(res, err); }
    },
    async login(req: Req, res: Res) {
      try {
        const user = await auth.login(req.body, req.ip);
        startSession(req, res, user, 200);
      } catch (err) { sendError(res, err); }
    },
    logout(req: Req, res: Res) {
      const token = parseCookies(header(req, "cookie"))[config.cookieName];
      sessions.destroy(token);
      res.setHeader("Set-Cookie", clearSessionCookie(config));
      res.status(200).json({ ok: true });
    },
    me(req: Req, res: Res) {
      if (!req.auth) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const a = req.auth;
      res.status(200).json({
        user: { id: a.userId, email: a.email, displayName: a.displayName, role: a.role },
        csrfToken: a.csrfToken,
        geminiConfigured: deps.geminiConfigured(),
      });
    },
  };
}
