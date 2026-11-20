/** Per-user daily token budget stored in SQLite (survives restarts). Reservation is atomic to stop concurrent overshoot. */
import type { Db } from "../db/database.ts";
import { withTransaction } from "../db/database.ts";

export class BudgetExceededError extends Error {
  status = 429;
  used: number;
  limit: number;
  constructor(used: number, limit: number) {
    super("Daily AI token budget exhausted");
    this.used = used;
    this.limit = limit;
  }
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function createTokenBudget(db: Db, opts: { dailyLimit: number; now?: () => number }) {
  const now = opts.now ?? Date.now;

  const usedToday = (userId: string): number => {
    const r = db.prepare("SELECT tokens FROM token_usage WHERE user_id = ? AND day = ?").get(userId, dayOf(now())) as { tokens: number } | undefined;
    return r?.tokens ?? 0;
  };

  return {
    limit: opts.dailyLimit,
    status(userId: string) {
      const used = usedToday(userId);
      return { used, limit: opts.dailyLimit, remaining: Math.max(0, opts.dailyLimit - used) };
    },
    /** Reserves `tokens` or throws BudgetExceededError. Returns the reservation to settle later. */
    reserve(userId: string, tokens: number): number {
      const need = Math.max(1, Math.ceil(tokens));
      withTransaction(db, () => {
        const day = dayOf(now());
        const row = db.prepare("SELECT tokens FROM token_usage WHERE user_id = ? AND day = ?").get(userId, day) as { tokens: number } | undefined;
        const used = row?.tokens ?? 0;
        if (used + need > opts.dailyLimit) throw new BudgetExceededError(used, opts.dailyLimit);
        db.prepare(
          `INSERT INTO token_usage (user_id, day, tokens, calls) VALUES (?, ?, ?, 1)
           ON CONFLICT(user_id, day) DO UPDATE SET tokens = tokens + excluded.tokens, calls = calls + 1`
        ).run(userId, day, need);
      });
      return need;
    },
    /** Replaces the reservation with the actual usage (never negative, never refunds below zero). */
    settle(userId: string, reserved: number, actual: number): void {
      const delta = Math.ceil(actual) - reserved;
      if (delta === 0) return;
      db.prepare("UPDATE token_usage SET tokens = MAX(0, tokens + ?) WHERE user_id = ? AND day = ?").run(delta, userId, dayOf(now()));
    },
  };
}
export type TokenBudget = ReturnType<typeof createTokenBudget>;
