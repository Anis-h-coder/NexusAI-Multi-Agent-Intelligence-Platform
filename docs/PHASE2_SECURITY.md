# Phase 2 – Security hardening (authentication, API protection, AI guardrails)

## What changed
* **Authentication & sessions** – email/password accounts (scrypt, per-user random salt), server-side sessions
  (only the SHA-256 of the cookie token is stored), `HttpOnly` + `SameSite` + `Secure` cookies (`__Host-` prefix in production),
  idle + absolute expiry, brute-force lockout keyed by (account, IP) so an attacker cannot lock the real owner out.
* **CSRF** – Origin/`Sec-Fetch-Site` check on every state-changing request **plus** a per-session `X-CSRF-Token`.
* **All `/api` routes require a session** except `GET /api/health` (minimal), `POST /api/auth/register|login`, `GET /api/auth/me`.
* **Strict CORS allowlist** (`ALLOWED_ORIGINS`), no wildcard, credentials only for listed origins.
* **Security headers** (CSP in production, nosniff, frame-ancestors none, HSTS when cookies are Secure, no-store on API).
* **Request validation** – every body is schema-validated, length-bounded; unknown fields are dropped.
  JSON body limit lowered from 25 MB to 2 MB (`MAX_JSON_BYTES`); auth routes use 16 KB.
* **Rate limits** – general API, LLM routes, login, registration.
* **AI guardrails** – all model calls go through one gateway: per-user daily token budget (atomic reservation), output-token cap,
  overall deadline, bounded retries, tools stripped, secret redaction of model output; user text/uploaded documents/chat history are
  wrapped as *untrusted data*; agent `role` is a strict allowlist; model-generated SQL must be a single read-only `SELECT/WITH`.
* **No raw error text** is returned to clients; logs are secret-redacted.
* **Persistence** – SQLite (`node:sqlite`, Node >= 22.13) under `DATA_DIR`. **Mount a persistent volume there in production.**
* Removed the hardcoded demo identity and JWT-shaped token from the client source.

## Breaking changes / required configuration
| Change | Action |
|---|---|
| Login is now required for the whole app | Users register on first visit (`ALLOW_REGISTRATION=false` to close sign-up after creating accounts). |
| `NODE_ENV=production` for any deployment | Enables CSP, Secure cookies, disables the Vite dev server. |
| Behind a reverse proxy / TLS terminator | Set `TRUST_PROXY=1` so rate limits and audit logs see real client IPs. |
| Plain-http local test of a production build | `COOKIE_SECURE=false` (never in real deployments). |
| Cross-origin frontend | List it in `ALLOWED_ORIGINS`; cookies then need `COOKIE_SAMESITE=none` (+ HTTPS). |
| `/api/health` | Now returns only `{status,timestamp}`. Gemini-key status is returned by `/api/auth/me` after sign-in. |
| Error shapes | 401 auth required · 403 CSRF/origin · 429 rate/budget · 422 rejected SQL · 504 model timeout. |
| Node version | `engines: node >= 22.13`. |

## Vercel (legacy path – not removed yet)
`api/index.ts` and `vercel.json` are kept, but the wildcard CORS headers were **removed**. Serverless has an ephemeral filesystem, so
accounts/sessions stored in SQLite are lost on cold starts. Treat Vercel as unsupported for authenticated multi-user use; it will be
retired only after the Docker deployment of the Fleet is verified.

## Verify locally (commands the sandbox could not run: no npm registry access)
```bash
npm install
npm run lint                 # tsc --noEmit
npm run build                # vite build + esbuild server bundle
npm test                     # unit tests (no packages needed)
npm run test:harness         # real server.ts with stubbed express/genai (route gating, prompts, validation)
npm audit --omit=dev         # dependency vulnerabilities
NODE_ENV=production DATA_DIR=./data npm start   # then sign up in the browser
```
The harness does **not** replace a real HTTP test: it does not exercise Express body parsing, `req.ip`, or cookie transport.

## Known limitations (tracked)
* Duplicate-email registration reveals that an email exists (rate-limited; fixing requires an email-verification flow).
* In-memory rate limiter is per-process (fine for one container; use a shared store for replicas).
* Session cookie auth only; no password reset, MFA or admin UI yet.
* RAG, SQL Studio, AutoML and report fallbacks still return **simulated** data when the model is unavailable – labelling them is the next integrity step.

## Test commands added after the first Phase 2 drop
`npm run test:http` (real HTTP, separate server process), `npm run test:e2e` (real Chromium), `npm run test:all`.
See `docs/PHASE2_VERIFICATION.md` for what each one does and does not prove.
