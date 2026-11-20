/**
 * SQLite persistence via Node's built-in `node:sqlite` (Node >= 22.13).
 * Kept behind this thin module so the engine can be swapped (e.g. better-sqlite3) without touching callers.
 * All data lives under DATA_DIR, which must be a persistent volume in production.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export type Db = DatabaseSync;

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name  TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
        disabled      INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL,
        last_login_at INTEGER
      );
      CREATE TABLE sessions (
        id           TEXT PRIMARY KEY,           -- sha256(token); the raw token is never stored
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf_token   TEXT NOT NULL,
        created_at   INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at   INTEGER NOT NULL,
        ip           TEXT,
        user_agent   TEXT
      );
      CREATE INDEX idx_sessions_user ON sessions(user_id);
      CREATE INDEX idx_sessions_expires ON sessions(expires_at);
      CREATE TABLE auth_throttle (
        key          TEXT PRIMARY KEY,
        failures     INTEGER NOT NULL,
        window_start INTEGER NOT NULL,
        locked_until INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE token_usage (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day     TEXT NOT NULL,
        tokens  INTEGER NOT NULL DEFAULT 0,
        calls   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
      );
      CREATE TABLE audit_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT,
        event      TEXT NOT NULL,
        detail     TEXT,
        ip         TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_audit_created ON audit_log(created_at);
    `,
  },
];

export function openDatabase(dataDir: string, filename = "nexus.db"): Db {
  let target = filename;
  if (filename !== ":memory:") {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    target = path.join(dataDir, filename);
  }
  const db = new DatabaseSync(target);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  if (filename !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
  }
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version)
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    withTransaction(db, () => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(m.version, Date.now());
    });
  }
}

/** Runs fn inside BEGIN IMMEDIATE ... COMMIT; rolls back on any throw. */
export function withTransaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    throw err;
  }
}
