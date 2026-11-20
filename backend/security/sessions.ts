/**
 * Server-side sessions. The cookie carries a random 256-bit token; only its SHA-256 is stored,
 * so a leaked database cannot be replayed as live sessions. Each session also owns a CSRF token.
 */
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { Db } from "../db/database.ts";

export interface AuthContext {
  userId: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  sessionId: string;
  csrfToken: string;
}

export interface SessionOptions {
  ttlMs: number;
  idleMs: number;
  now?: () => number;
}

const TOUCH_INTERVAL_MS = 60_000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createSessionService(db: Db, opts: SessionOptions) {
  const now = opts.now ?? Date.now;

  return {
    create(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
      const token = randomBytes(32).toString("base64url");
      const csrfToken = randomBytes(24).toString("base64url");
      const t = now();
      const expiresAt = t + opts.ttlMs;
      db.prepare(
        "INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?,?)"
      ).run(hashToken(token), userId, csrfToken, t, t, expiresAt, meta.ip ?? null, (meta.userAgent ?? "").slice(0, 300));
      return { token, csrfToken, expiresAt };
    },

    /** Returns the auth context for a raw cookie token, or null if unknown/expired/idle/disabled. */
    validate(token: string | undefined | null): AuthContext | null {
      if (!token || token.length < 20 || token.length > 128) return null;
      const id = hashToken(token);
      const row = db
        .prepare(
          `SELECT s.id, s.csrf_token, s.last_seen_at, s.expires_at, u.id AS user_id, u.email, u.display_name, u.role, u.disabled
           FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
        )
        .get(id) as
        | { id: string; csrf_token: string; last_seen_at: number; expires_at: number; user_id: string; email: string; display_name: string; role: "user" | "admin"; disabled: number }
        | undefined;
      if (!row) return null;
      const t = now();
      if (row.expires_at <= t || row.last_seen_at + opts.idleMs <= t || row.disabled) {
        db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
        return null;
      }
      if (t - row.last_seen_at > TOUCH_INTERVAL_MS) {
        db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(t, id);
      }
      return {
        userId: row.user_id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        sessionId: id,
        csrfToken: row.csrf_token,
      };
    },

    destroy(token: string | undefined | null): void {
      if (!token) return;
      db.prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
    },

    destroyAllForUser(userId: string): void {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    },

    purgeExpired(): number {
      const t = now();
      const res = db.prepare("DELETE FROM sessions WHERE expires_at <= ? OR last_seen_at + ? <= ?").run(t, opts.idleMs, t);
      return Number(res.changes);
    },
  };
}
export type SessionService = ReturnType<typeof createSessionService>;
