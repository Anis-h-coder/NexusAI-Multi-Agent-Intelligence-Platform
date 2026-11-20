# Phase 2 verification record

Authoring sandbox: **no npm/PyPI/GitHub access**, so `npm install`, the Vite build, `npm audit` and real Express could not run there.
This file states exactly what was verified, how, and what is still open. Nothing below is marked "passed" unless it was executed.

## Verified in the sandbox (executed, results are real)
| Layer | Command | Result | What it actually exercises |
|---|---|---|---|
| Unit | `npm test` | **58 / 58** | scrypt, sessions, throttling, CORS/CSRF/headers, validators, LLM gateway/budget, SQL guard, redaction, apiClient, static frontend guards |
| Route harness | `npm run test:harness` | **14 / 14** | the real `server.ts` handlers + middleware order, in-process (stubbed express/@google/genai/dotenv) |
| **Real HTTP** | `npm run test:http` | **10 / 10** | real `server.ts` in a separate OS process over TCP: cookies on the wire, CSRF, CORS preflight, 400/413 body errors, headers/CSP, rate limit, **session persistence across a process restart**, no plaintext password / raw session token on disk |
| **Real browser** | `npm run test:e2e` | **9 / 9** | real `App.tsx`/AuthScreen/Navbar/apiClient in Chromium against that server: anonymous gate, weak-password error, register, reload keeps session, logout (server-side revoke), login errors, 401 → back to sign-in, **forged cross-site logout + cross-origin read blocked**, CSP blocks injected inline script |
| Type-check (strict) | `tsc --strict` on `backend/`, tests, `apiClient` | 0 errors (checker proven to fail on injected errors) | semantic types for everything not touching Express/React |
| Production bundle | `esbuild server.ts --bundle --platform=node --format=cjs --packages=external` | builds, 0 warnings; runtime externals are only `express`, `dotenv`, `@google/genai` + Node built-ins | the same flags as `npm run build` (server half) |
| Frontend bundle | esbuild bundle of the real app (36 source files) | 0 warnings | all imports/exports resolve, all TSX parses |
| Mutation checks | 23 clean runs that deliberately break security code (harness 7, real-HTTP 5, browser 5, unit 6) | **21 caught, 2 equivalent** (role allowlist and early budget gate are each duplicated by a second layer, so removing one changes nothing observable) | the tests can fail. An earlier round exposed one real gap (provider error text reaching the client/logs) which was fixed and is now covered by unit tests; rounds contaminated by a runner bug were discarded and not counted |

### Stubbed / not real in those runs (be aware)
* Express routing, `express.json`, static serving are **harness reimplementations** (body-parser semantics mirrored: 413 `entity.too.large`, 400 `entity.parse.failed`, strict mode).
* `@google/genai` is a recording stub; no real model was called.
* Browser bundle stubs `lucide-react`, `recharts`, `react-markdown`, `remark-gfm`, `jspdf` and does not process Tailwind CSS. It is **not** the Vite build.

## NOT verified – run on a machine with network access
```bash
npm install
npm run lint                         # tsc --noEmit with real React/Express types  (never run on Phase 2 code with these types)
npm run build                        # vite build + esbuild server bundle
npm audit --omit=dev                 # dependency vulnerabilities (unknown until run)
npm test && npm run test:harness     # must still be 58 + 14
npx playwright install chromium
npm run test:all                     # shim mode again, on your Node/OS

# The decisive checks: same HTTP suite against REAL Express and the real Vite build
npm run build
E2E_REAL_EXPRESS=1 npm run test:http   # spawns `tsx server.ts` with real express (helper path is unverified)
NODE_ENV=production DATA_DIR=./data npm start   # then sign up / reload / sign out in a real browser
```
Pass criteria: lint 0 errors; build succeeds; `E2E_REAL_EXPRESS=1 npm run test:http` = 10/10.
**Treat Phase 2 as "not production-verified" until those pass.** If any fail, send me the output.

## Findings from this verification round
* `PORT=0` is correctly rejected by config validation (fail-fast works); the harness uses `SHIM_PORT`.
* `playwright` is declared in `dependencies` and was flagged earlier as unused. It is now used by `test:e2e` – **keep it (move to devDependencies)**, do not remove.
* `isDirectRun` in `server.ts` is true for `tsx server.ts`, `node dist/server.cjs` and false for the Vercel import (checked for each launch path).
* The Vite dev/prod split relies on `NODE_ENV`; Docker must set `NODE_ENV=production`.

## SQLite driver evaluation (`node tests/bench/sqlite-eval.mjs`, Node 22.23, SQLite 3.53.4)
| Measure | node:sqlite result |
|---|---|
| 100k rows, one transaction | 65 ms |
| 5,000 autocommit inserts (WAL, synchronous=NORMAL) | ~105k/s |
| 100k point reads | 159 ms |
| 4 OS processes × 1,500 write transactions on one file | 0 errors, 6000/6000 rows, ~0.2 s |
| `SIGKILL` of a writer mid-stream, reopen | `integrity_check = ok`, rows contiguous 1..N, nothing committed lost |
| Event-loop stall during a deliberately pathological self-join | ~8.9 s (**applies to any synchronous driver, incl. better-sqlite3**) |

Not measured (could not install): better-sqlite3 performance, its prebuilt-binary availability on your base image, or its current maintenance state. **Power-loss durability** (OS crash) was not tested; with `synchronous=NORMAL` the last commits can be lost on power loss (never corruption).
