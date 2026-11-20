/**
 * Single choke point for every model call: budget reservation, output cap, overall deadline,
 * bounded retries with model fallback, and secret redaction of the returned text.
 */
import type { TokenBudget } from "./budget.ts";
import { estimateTokens, redactSecrets } from "./guard.ts";

export class LlmTimeoutError extends Error {
  status = 504;
  constructor() { super("The AI model did not respond in time"); }
}
export class LlmUnavailableError extends Error {
  status = 503;
  constructor(message = "The AI service is not configured") { super(message); }
}

export interface GeminiLike {
  models: { generateContent(args: { model: string; contents: any; config?: any }): Promise<any> };
}

export interface GatewayOptions {
  budget: TokenBudget;
  models: string[];
  timeoutMs: number;
  maxOutputTokens: number;
  getClient: () => GeminiLike | null;
  secrets?: () => string[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxAttemptsPerModel?: number;
}

const isTransient = (err: any): boolean =>
  err?.status === 503 || err?.status === 429 || err?.code === 503 || err?.code === 429 ||
  /503|429|high demand|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(String(err?.message ?? ""));

export function createLlmGateway(o: GatewayOptions) {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const attemptsPerModel = o.maxAttemptsPerModel ?? 2;

  function withDeadline<T>(p: Promise<T>, remainingMs: number): Promise<T> {
    if (remainingMs <= 0) return Promise.reject(new LlmTimeoutError());
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new LlmTimeoutError()), remainingMs); });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }

  return {
    /** Returns a minimal `{ text }` so callers never see raw SDK objects. */
    async generate(args: { userId: string; contents: any; config?: any; preferredModel?: string }): Promise<{ text: string; tokensUsed: number }> {
      const client = o.getClient();
      if (!client) throw new LlmUnavailableError("GEMINI_API_KEY is not configured on the server");

      const config = { ...(args.config ?? {}) };
      config.maxOutputTokens = Math.min(Number(config.maxOutputTokens) || o.maxOutputTokens, o.maxOutputTokens);
      delete config.tools; // the platform grants models no tools on legacy routes (least privilege)

      const promptText = typeof args.contents === "string" ? args.contents : JSON.stringify(args.contents);
      const promptTokens = estimateTokens(promptText);
      const reserved = o.budget.reserve(args.userId, promptTokens + config.maxOutputTokens);

      const deadline = now() + o.timeoutMs;
      const candidates = Array.from(new Set([args.preferredModel, ...o.models].filter(Boolean) as string[]));
      let lastError: any;
      try {
        for (const model of candidates) {
          for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
            try {
              const response = await withDeadline(client.models.generateContent({ model, contents: args.contents, config }), deadline - now());
              const text = redactSecrets(String(response?.text ?? ""), o.secrets?.() ?? []);
              const used = Number(response?.usageMetadata?.totalTokenCount) || promptTokens + estimateTokens(text);
              o.budget.settle(args.userId, reserved, used);
              return { text, tokensUsed: used };
            } catch (err: any) {
              lastError = err;
              if (err instanceof LlmTimeoutError) throw err;
              if (isTransient(err) && attempt < attemptsPerModel) {
                await sleep(Math.min(1000 * attempt + Math.floor(Math.random() * 300), Math.max(0, deadline - now())));
                continue;
              }
              break; // next fallback model
            }
          }
        }
        throw lastError ?? new Error("AI call failed");
      } catch (err) {
        // Failed calls consume (almost) nothing: keep prompt estimate only.
        o.budget.settle(args.userId, reserved, promptTokens);
        throw err;
      }
    },
  };
}
export type LlmGateway = ReturnType<typeof createLlmGateway>;
