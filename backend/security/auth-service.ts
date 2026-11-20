/** User accounts and login with brute-force throttling. */
import { randomUUID } from "node:crypto";
import type { Db } from "../db/database.ts";
import { hashPassword, verifyPassword, verifyAgainstDummy, validatePasswordPolicy } from "./passwords.ts";
import type { AuditLog } from "./audit.ts";

export class AuthError extends Error {
  status: number;
  code: string;
  retryAfterSec?: number;
  constructor(status: number, code: string, message: string, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
}

const EMAIL_RE = /^[^\s@<>()\[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== "string") throw new AuthError(400, "invalid_email", "A valid email is required");
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email) || email.includes("..")) {
    throw new AuthError(400, "invalid_email", "A valid email is required");
  }
  return email;
}

export function normalizeDisplayName(raw: unknown, email: string): string {
  const base = typeof raw === "string" ? raw : "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 80);
  return cleaned || email.split("@")[0];
}

export interface ThrottleConfig {
  /** failures per (account, ip) pair before a lock */
  accountFailures: number;
  /** failures per ip before a lock */
  ipFailures: number;
  windowMs: number;
  lockMs: number;
}

export const DEFAULT_THROTTLE: ThrottleConfig = {
  accountFailures: 5,
  ipFailures: 20,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

export function createAuthService(
  db: Db,
  audit: AuditLog,
  opts: { throttle?: ThrottleConfig; now?: () => number } = {}
) {
  const throttle = opts.throttle ?? DEFAULT_THROTTLE;
  const now = opts.now ?? Date.now;

  const toPublic = (row: { id: string; email: string; display_name: string; role: "user" | "admin" }): PublicUser => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  });

  function lockRemainingSec(key: string): number {
    const row = db.prepare("SELECT locked_until FROM auth_throttle WHERE key = ?").get(key) as { locked_until: number } | undefined;
    if (!row) return 0;
    const left = row.locked_until - now();
    return left > 0 ? Math.ceil(left / 1000) : 0;
  }

  function recordFailure(key: string, limit: number): void {
    const t = now();
    const row = db.prepare("SELECT failures, window_start FROM auth_throttle WHERE key = ?").get(key) as
      | { failures: number; window_start: number }
      | undefined;
    if (!row || t - row.window_start > throttle.windowMs) {
      db.prepare("INSERT OR REPLACE INTO auth_throttle (key, failures, window_start, locked_until) VALUES (?,?,?,0)").run(key, 1, t);
      return;
    }
    const failures = row.failures + 1;
    const lockedUntil = failures >= limit ? t + throttle.lockMs : 0;
    db.prepare("UPDATE auth_throttle SET failures = ?, locked_until = ? WHERE key = ?").run(failures, lockedUntil, key);
  }

  return {
    async register(input: { email: unknown; password: unknown; displayName?: unknown }, ip?: string | null): Promise<PublicUser> {
      const email = normalizeEmail(input.email);
      if (typeof input.password !== "string") throw new AuthError(400, "invalid_password", "Password is required");
      const problems = validatePasswordPolicy(input.password, email);
      if (problems.length) throw new AuthError(400, "weak_password", problems.join("; "));

      const passwordHash = await hashPassword(input.password);
      const id = randomUUID();
      try {
        db.prepare("INSERT INTO users (id, email, display_name, password_hash, role, created_at) VALUES (?,?,?,?,?,?)").run(
          id, email, normalizeDisplayName(input.displayName, email), passwordHash, "user", now()
        );
      } catch (err) {
        if (/UNIQUE/i.test((err as Error).message)) {
          audit.log("register_duplicate", { ip });
          throw new AuthError(409, "email_taken", "An account with this email already exists");
        }
        throw err;
      }
      audit.log("register", { userId: id, ip });
      const row = db.prepare("SELECT id, email, display_name, role FROM users WHERE id = ?").get(id) as any;
      return toPublic(row);
    },

    async login(input: { email: unknown; password: unknown }, ip?: string | null): Promise<PublicUser> {
      const generic = new AuthError(401, "invalid_credentials", "Invalid email or password");
      let email: string;
      try {
        email = normalizeEmail(input.email);
      } catch {
        await verifyAgainstDummy(String(input.password ?? ""));
        throw generic;
      }
      const password = typeof input.password === "string" ? input.password.slice(0, 256) : "";
      const ipKey = `ip:${ip ?? "unknown"}`;
      // Keyed by (account, ip) so an attacker can only lock *themselves* out of an account, never the real owner.
      const acctKey = `acct:${email}|${ip ?? "unknown"}`;

      const wait = Math.max(lockRemainingSec(ipKey), lockRemainingSec(acctKey));
      if (wait > 0) {
        audit.log("login_throttled", { ip });
        throw new AuthError(429, "too_many_attempts", "Too many failed attempts. Try again later.", wait);
      }

      const row = db
        .prepare("SELECT id, email, display_name, role, password_hash, disabled FROM users WHERE email = ?")
        .get(email) as { id: string; email: string; display_name: string; role: "user" | "admin"; password_hash: string; disabled: number } | undefined;

      let ok = false;
      if (row) ok = await verifyPassword(password, row.password_hash);
      else await verifyAgainstDummy(password);

      if (!row || !ok || row.disabled) {
        recordFailure(ipKey, throttle.ipFailures);
        recordFailure(acctKey, throttle.accountFailures);
        audit.log("login_failure", { userId: row?.id ?? null, ip });
        throw generic;
      }
      db.prepare("DELETE FROM auth_throttle WHERE key = ?").run(acctKey);
      db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now(), row.id);
      audit.log("login_success", { userId: row.id, ip });
      return toPublic(row);
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
