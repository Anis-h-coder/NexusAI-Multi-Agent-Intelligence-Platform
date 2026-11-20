import type { Db } from "../db/database.ts";

/** Security event log. `detail` must never contain secrets, passwords, tokens or request bodies. */
export function createAuditLog(db: Db, now: () => number = Date.now) {
  const insert = db.prepare("INSERT INTO audit_log (user_id, event, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)");
  return {
    log(event: string, info: { userId?: string | null; ip?: string | null; detail?: string } = {}): void {
      try {
        insert.run(info.userId ?? null, event, (info.detail ?? "").slice(0, 500), info.ip ?? null, now());
      } catch (err) {
        console.error("[audit] failed to write event", event, (err as Error).message);
      }
    },
    purgeOlderThan(ms: number): void {
      db.prepare("DELETE FROM audit_log WHERE created_at < ?").run(now() - ms);
    },
  };
}
export type AuditLog = ReturnType<typeof createAuditLog>;
