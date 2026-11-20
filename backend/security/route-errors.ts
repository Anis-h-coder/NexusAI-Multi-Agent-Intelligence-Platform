import type { Req, Res } from "./http-types.ts";
import type { AuditLog } from "./audit.ts";
import { BudgetExceededError } from "../llm/budget.ts";
import { LlmTimeoutError, LlmUnavailableError } from "../llm/gateway.ts";
import { redactSecrets } from "../llm/guard.ts";

/**
 * Maps internal route failures to safe client responses. Raw error text is never sent to clients and is
 * redacted (known secrets + key-shaped strings) before it is written to server logs.
 */
export function createRouteErrorSender(deps: { audit: AuditLog; log?: (msg: string) => void; secrets?: () => string[] }) {
  const log = deps.log ?? ((m: string) => console.error(m));
  return (req: Req, res: Res, err: unknown, label: string) => {
    if (err instanceof BudgetExceededError) {
      deps.audit.log("budget_exceeded", { userId: req.auth?.userId, ip: req.ip });
      return res.status(429).json({ error: "Daily AI token budget exhausted. Try again tomorrow." });
    }
    if (err instanceof LlmTimeoutError) return res.status(504).json({ error: "The AI model took too long to respond. Please retry." });
    if (err instanceof LlmUnavailableError) return res.status(503).json({ error: "The AI service is not available on this server." });
    const raw = String((err as Error)?.message ?? err).slice(0, 300);
    log(`[NexusAI] ${label} failed [${req.id ?? "-"}]: ${redactSecrets(raw, deps.secrets?.() ?? [])}`);
    return res.status(500).json({ error: label, requestId: req.id });
  };
}
