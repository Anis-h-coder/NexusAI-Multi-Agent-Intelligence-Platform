import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../../backend/db/database.ts";
import { createAuditLog } from "../../backend/security/audit.ts";
import { createSessionService, hashToken } from "../../backend/security/sessions.ts";
import { createAuthService, AuthError } from "../../backend/security/auth-service.ts";

function setup(clock = { t: 1_000_000 }) {
  const db = openDatabase("", ":memory:");
  const audit = createAuditLog(db, () => clock.t);
  const sessions = createSessionService(db, { ttlMs: 3_600_000, idleMs: 600_000, now: () => clock.t });
  const auth = createAuthService(db, audit, { now: () => clock.t });
  return { db, sessions, auth, clock };
}
const PW = "a-sufficiently-long-passphrase";

test("register + login round-trip; duplicate email rejected (case-insensitive)", async () => {
  const { auth } = setup();
  const u = await auth.register({ email: "Alice@Example.com", password: PW, displayName: "Alice" }, "1.1.1.1");
  assert.equal(u.email, "alice@example.com");
  const again = await auth.login({ email: "alice@example.com", password: PW }, "1.1.1.1");
  assert.equal(again.id, u.id);
  await assert.rejects(auth.register({ email: "ALICE@example.com", password: PW }), (e: AuthError) => e.status === 409);
});

test("register validates email and password policy", async () => {
  const { auth } = setup();
  await assert.rejects(auth.register({ email: "not-an-email", password: PW }), (e: AuthError) => e.code === "invalid_email");
  await assert.rejects(auth.register({ email: "a@b.com", password: "short" }), (e: AuthError) => e.code === "weak_password");
  await assert.rejects(auth.register({ email: "a@b.com", password: 12345 as any }), (e: AuthError) => e.status === 400);
});

test("login failure message is identical for unknown user and wrong password", async () => {
  const { auth } = setup();
  await auth.register({ email: "bob@example.com", password: PW });
  const e1 = await auth.login({ email: "bob@example.com", password: "wrong-password-1" }, "9.9.9.9").catch((e) => e);
  const e2 = await auth.login({ email: "nobody@example.com", password: "wrong-password-1" }, "9.9.9.9").catch((e) => e);
  assert.equal(e1.status, 401);
  assert.equal(e1.message, e2.message);
  assert.equal(e1.code, e2.code);
});

test("brute force: account+ip lock after 5 failures, then 429 even with the right password", async () => {
  const { auth, clock } = setup();
  await auth.register({ email: "carol@example.com", password: PW });
  for (let i = 0; i < 5; i++) {
    await assert.rejects(auth.login({ email: "carol@example.com", password: "bad-guess-" + i }, "5.5.5.5"), (e: AuthError) => e.status === 401);
  }
  await assert.rejects(auth.login({ email: "carol@example.com", password: PW }, "5.5.5.5"), (e: AuthError) => e.status === 429 && (e.retryAfterSec ?? 0) > 0);
  // The legitimate owner on a different IP is NOT locked out by the attacker.
  const ok = await auth.login({ email: "carol@example.com", password: PW }, "6.6.6.6");
  assert.equal(ok.email, "carol@example.com");
  // Lock expires.
  clock.t += 16 * 60_000;
  assert.equal((await auth.login({ email: "carol@example.com", password: PW }, "5.5.5.5")).email, "carol@example.com");
});

test("sessions: raw token is never stored; validate/expire/idle/destroy", async () => {
  const { db, sessions, auth, clock } = setup();
  const u = await auth.register({ email: "dave@example.com", password: PW });
  const s = sessions.create(u.id, { ip: "1.2.3.4", userAgent: "ua" });

  const stored = db.prepare("SELECT id, csrf_token FROM sessions").all() as { id: string; csrf_token: string }[];
  assert.equal(stored.length, 1);
  assert.notEqual(stored[0].id, s.token);
  assert.equal(stored[0].id, hashToken(s.token));
  const dump = JSON.stringify(db.prepare("SELECT * FROM sessions").all());
  assert.ok(!dump.includes(s.token), "raw token must not appear in DB");

  assert.equal(sessions.validate(s.token)?.userId, u.id);
  assert.equal(sessions.validate(s.token)?.csrfToken, s.csrfToken);
  assert.equal(sessions.validate("x".repeat(43)), null);
  assert.equal(sessions.validate(""), null);

  clock.t += 11 * 60_000; // > idle timeout
  assert.equal(sessions.validate(s.token), null, "idle session must expire");

  const s2 = sessions.create(u.id);
  clock.t += 3_700_000; // > absolute ttl
  assert.equal(sessions.validate(s2.token), null, "absolute expiry");

  const s3 = sessions.create(u.id);
  sessions.destroy(s3.token);
  assert.equal(sessions.validate(s3.token), null, "destroyed");
});

test("disabled users lose access immediately; destroyAllForUser revokes every session", async () => {
  const { db, sessions, auth } = setup();
  const u = await auth.register({ email: "erin@example.com", password: PW });
  const a = sessions.create(u.id);
  const b = sessions.create(u.id);
  db.prepare("UPDATE users SET disabled = 1 WHERE id = ?").run(u.id);
  assert.equal(sessions.validate(a.token), null);
  db.prepare("UPDATE users SET disabled = 0 WHERE id = ?").run(u.id);
  sessions.destroyAllForUser(u.id);
  assert.equal(sessions.validate(b.token), null);
});

test("session tokens are unique and high-entropy", async () => {
  const { sessions, auth } = setup();
  const u = await auth.register({ email: "frank@example.com", password: PW });
  const tokens = new Set(Array.from({ length: 50 }, () => sessions.create(u.id).token));
  assert.equal(tokens.size, 50);
  for (const t of tokens) assert.ok(t.length >= 43);
});

test("audit log records auth events without secrets", async () => {
  const { db, auth } = setup();
  await auth.register({ email: "gina@example.com", password: PW }, "7.7.7.7");
  await auth.login({ email: "gina@example.com", password: "nope-nope-nope" }, "7.7.7.7").catch(() => {});
  const rows = db.prepare("SELECT event, detail FROM audit_log ORDER BY id").all() as { event: string; detail: string }[];
  assert.deepEqual(rows.map((r) => r.event), ["register", "login_failure"]);
  assert.ok(!JSON.stringify(rows).includes(PW));
});
