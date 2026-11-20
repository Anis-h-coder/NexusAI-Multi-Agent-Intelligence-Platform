# Phase 3 plan – Fleet foundation (persistence, orchestration, uploads, Python worker, Docker, live updates)

Status: **plan only. No Phase 3 code has been written.** Gate: Phase 2 real-runtime checks in `docs/PHASE2_VERIFICATION.md`
must be run on a networked machine (lint, build, `npm audit`, `E2E_REAL_EXPRESS=1 npm run test:http`) before this starts.
Everything in Phase 2 stays intact; Phase 3 only adds files and one new SQL migration.

## 0. Principles (non-negotiable)
1. **Nothing is fabricated.** Progress = persisted task state. Metrics = numbers produced by the Python worker (documentation templates
   copy them from `metrics.json`; the LLM never types a metric). Research sources = Gemini grounding metadata only.
2. **Untrusted code never runs in the API process.** LLM output is data. Plans may only contain whitelisted task types with
   whitelisted parameters (no shell, no free-form code). Python jobs run *fixed, reviewed scripts*.
3. **Every row is owned.** All repository functions take `userId`; nothing fetches by id alone; cross-user access answers 404.
4. **Least privilege per agent.** Only Research may use a tool (Google Search grounding). No agent gets filesystem, network or DB access.
5. **Bounded everything:** tasks per plan, tokens per execution, wall-clock per task, bytes per upload, rows per dataset, CPU/RAM per job.

## 1. Persistent execution database (migration 2, same `node:sqlite` file, `DATA_DIR` volume)
| Table | Purpose / key columns |
|---|---|
| `projects` | `id, user_id, name, created_at` (optional grouping; a default project is created lazily) |
| `executions` | `id, user_id, project_id, title, requirement, mode(automatic\|supervised\|manual), status, plan_version, token_budget, tokens_used, pause_requested, cancel_requested, created/started/finished_at, error_code` |
| `execution_plans` | `execution_id, version, status(draft\|approved\|superseded\|rejected), plan_json, created_by(planner\|user), approved_at` |
| `tasks` | `id, execution_id, user_id, key, agent, title, params_json, status, attempt, max_attempts, started/finished_at, progress_done, progress_total, output_ref, error_code, error_message, lease_owner, lease_expires_at, tokens_used` |
| `task_dependencies` | `(task_id, depends_on_task_id)` – the DAG |
| `task_attempts` | per-attempt history (start/end/status/error) |
| `messages` | agent-to-agent communication: `execution_id, seq, ts, from_agent, to_agent, kind(plan\|handoff\|result\|validation\|retry\|error\|system), task_id, summary` |
| `events` | append-only change feed `execution_id, seq(monotonic per execution), ts, type, data_json` – source for SSE replay and polling |
| `uploads` | `id, user_id, execution_id?, original_name(display only), stored_name(random), kind, size, sha256, sniffed_type, status(quarantined\|validated\|rejected), profile_json` |
| `artifacts` | `id, execution_id, task_id, user_id, kind, name, stored_name, mime(allowlist), size, sha256` |
Indexes on `(user_id, created_at)`, `(execution_id, seq)`, `(status)`; `ON DELETE CASCADE` from executions; per-user storage quota table.
Large payloads (datasets, models, reports) live **on disk** under `DATA_DIR/{uploads,artifacts}`, never as SQLite blobs (keeps queries fast and the event loop free).

**Driver decision.** Keep `node:sqlite` behind the existing `openDatabase` module *and* add a driver-contract test suite (same tests, any driver)
so `better-sqlite3` can be dropped in. Evidence so far (see verification doc): node:sqlite is fast enough, multi-process safe in WAL, crash-safe.
Its risks: still flagged experimental in Node 22 (API may change, prints a warning), needs Node ≥ 22.13, no helper for transactions (we have one).
better-sqlite3's trade-offs (from general knowledge, **not measured here**): mature/widely deployed and API-stable, but a native addon (prebuilt binaries
must exist for your OS/arch/Node ABI, otherwise a compiler toolchain is needed in the image). **Recommendation:** stay on node:sqlite through Phase 3 development;
before declaring production-ready, run the contract + `tests/bench/sqlite-eval.mjs` against better-sqlite3 on your Docker base image and switch if the Node LTS
you deploy still marks `node:sqlite` experimental or you need its stability guarantees. Single writer process only (one app replica); data volume must be a
*local* volume (never NFS/SMB); scheduled `VACUUM INTO` backups.

## 2. Task and message management
* **State machine (persisted, transition table enforced in one function):**
  `pending → ready → running → succeeded | failed | cancelled`; `pending → blocked/skipped` when an upstream failed; `awaiting_approval` in manual mode; `paused` is an execution-level flag, not a task state.
* Every transition runs in a `BEGIN IMMEDIATE` transaction that also inserts the `events` row (state and notification can never diverge).
* Retry: `max_attempts` default 3, exponential backoff for *transient* causes only (LLM 429/503/timeout, worker infrastructure); validation failures get **one** repair retry with the validator's message appended; never infinite.
* Messages are written by the orchestrator, not by agents, from structured results (e.g. `planner → research: "task t2 assigned"`, `ml → documentation: "model artifact + metrics ready"`), so the log reflects what actually happened.

## 3. Six-agent orchestration
Common contract: `run(ctx, input) → output`, with schemas for `input` and `output` (our validator), a `ctx` exposing only: budgeted LLM gateway, an input-read/output-write workspace, `emit(log|progress|message)`, and a cancellation signal.
| Agent | Real implementation | Validation before downstream use |
|---|---|---|
| **Planner** | LLM → JSON plan (≤ 12 tasks, agents from allowlist, params from per-agent schemas). Deterministic pre-checks (e.g. no dataset ⇒ no analyst/ML tasks; asks the user instead). Also runs the final validate-and-combine step. | DAG acyclic, unknown keys dropped, every input reference resolves to an upstream task |
| **Research** | Gemini with Google Search grounding (the only tool grant). Sources taken only from `groundingMetadata`; if none come back the report says "no verifiable sources found". | every cited URL ∈ grounding set; claims without a source are flagged |
| **Data Analyst** | Python job `eda`: profile, missing values, duplicates, correlations, cleaning from a fixed menu of operations (LLM may *choose* among them, not invent code). Charts are JSON specs rendered by the existing Recharts. | output files exist, row/col counts match the cleaned CSV |
| **ML** | Python job `train`: problem-type detection (classification/regression/clustering), fixed algorithm catalog, sklearn `ColumnTransformer` pipeline, stratified split + CV, bounded randomized search, leakage heuristics, metrics, `model.joblib` + `pipeline`. | metrics re-derivable from `predictions.csv`; no metric without a file behind it |
| **Software** | LLM emits a file manifest (path + content). Server validates paths/extensions/size/count, then **static** checks (py_compile/pyflakes, `node --check`, JSON/YAML/HTML parse) inside the sandboxed worker. | path traversal rejected, syntax verified, report states exactly what was and was *not* verified |
| **Documentation** | Markdown generated from validated upstream artifacts; numeric facts inserted by template from `metrics.json`/`profile.json`. PDF via the existing client-side jsPDF generator. | every number in the doc must appear in an upstream artifact |

* **DAG scheduler** (in-process, single instance): each tick selects `pending` tasks whose dependencies are all `succeeded`, promotes them to `ready`, and starts up to the concurrency caps (global 4, per-agent 2, per-user 2 executions).
  Independent branches (e.g. Research ‖ Data Analyst) run in parallel; dependent steps run sequentially. Leases (`lease_expires_at`) + a boot-time recovery sweep make crashes safe (expired `running` → `ready`, attempt counted).
* **Modes:** *automatic* – plan auto-approved; *supervised* – stops at `awaiting_plan_approval` (user may edit task title/params; each edit re-validated, `plan_version` bumps); *manual* – additionally gates each task.
* **Pause/resume/cancel:** flags checked between tasks; running worker jobs are killed on cancel; partial deliverables are kept and labelled.

## 4. Secure dataset uploads (no multipart parser)
* `POST /api/fleet/uploads` takes a **raw octet-stream body** (filename/kind as validated query params). Streamed to a quarantine file with a hard byte cap (default 50 MB, configurable); abort + delete on overflow. No multipart library ⇒ smaller attack surface.
* Stored under a random server-generated name; the client filename is display-only and sanitized. Extension allowlist (`.csv .tsv .xlsx .json .txt .md`), magic-byte/type sniffing (xlsx must be a zip with the expected parts; csv must decode and contain no NULs; json must parse).
* Deep validation happens in the **sandboxed worker** (`validate_dataset` job: row/column caps, xlsx zip-bomb guard with entry-count and uncompressed-size limits, encoding detection, profile). Only `validated` uploads can be attached to an execution.
* Per-user quotas (bytes and file count); uploads are scoped to `user_id`; delete removes the file.
* **Downloads:** `GET /api/fleet/artifacts/:id/download` resolves by `id AND user_id`, builds the path from the DB `stored_name` with a containment check, always `Content-Disposition: attachment`, `nosniff`, MIME from a server allowlist (HTML/SVG are never rendered inline). Tampered `stored_name` ⇒ refused.
* Uploaded content (cell values, column names, document text) is **untrusted data**: LLMs receive schema/statistics and ≤ 5 truncated sample rows, always wrapped by `wrapUntrusted`.
* Model files are `joblib` (pickle): produced only by our worker and loaded only inside the worker; user-supplied model files are not accepted; downloads carry a "load only in a trusted environment" notice.

## 5. Isolated Python worker
* Separate image/service (`python:3.12-slim`), non-root user, read-only root FS, `tmpfs` scratch, `cap_drop: ALL`, `no-new-privileges`, `network_mode: none`, CPU/memory/pids limits, per-job timeout and output-size cap.
* Pinned dependencies (tested here against pandas 3.0.6, NumPy 2.5.4, scikit-learn 1.9.1, SciPy, joblib, openpyxl). Worker scripts and their unit tests can be developed and **fully run in the authoring sandbox**.
* **File-based job protocol** (no network exists): the app writes `jobs/pending/<id>/job.json` + copies *only that job's* inputs; the worker claims it by atomic `rename` to `running/`, runs the fixed script in a subprocess with `setrlimit` (CPU, address space, file size, open files) and a process-group kill on timeout, then writes `result.json` + `out/` and renames to `done/`.
* The worker mounts **only the jobs volume** – it cannot see the SQLite DB, uploads of other users, or the artifact store. The app *ingests* outputs (validate type/size, hash, move into the artifact store) so a compromised worker cannot forge artifacts.
* Job types: `validate_dataset`, `eda`, `train`, `predict`, `check_code`. Parameters are validated JSON enums/numbers, never code.

## 6. Docker configuration
* `Dockerfile` (app): multi-stage, `node:22-bookworm-slim`, `npm ci` (needs a committed `package-lock.json` – generate it locally), `npm run build`, non-root user, `NODE_ENV=production`, `HEALTHCHECK` on `/api/health`, volume `/data`.
* `worker/Dockerfile`: described above. `docker-compose.yml`: services `app` and `worker`; named volumes `nexus-data` (DB, uploads, artifacts) and `nexus-jobs` (shared job exchange only); `app` read-only root with `tmpfs /tmp`, resource limits, `restart: unless-stopped`; `.env` for secrets (never baked into images); optional reverse-proxy profile (`TRUST_PROXY=1`).
* **Cannot be built/run in the authoring sandbox (no Docker).** Deliverables will be reviewed statically and you run `docker compose config && docker compose build && docker compose up`; I will give a smoke-test script (`/api/health`, sign-up, upload, run) for that.

## 7. Real-time execution updates
* `GET /api/fleet/executions/:id/events` – **Server-Sent Events** (cookie auth, ownership check, `Last-Event-ID` replay from `events.seq`, 15 s heartbeat, per-user connection cap, slow-client drop, closes on terminal state). Mutations stay `POST` with the existing CSRF protection.
* Same data available by polling `GET …/executions/:id?afterSeq=n` (used by tests and as a fallback).
* Progress is only shown when measurable: worker stages (e.g. "CV fold 3/5"), LLM steps (prepare → call → validate), and execution-level `succeeded tasks / total tasks`. No timers, no animated fake percentages.

## 8. API surface (all behind the existing session + CSRF + validation + rate limits)
`POST/GET /api/fleet/executions`, `GET /:id`, `POST /:id/plan/approve`, `PATCH /:id/tasks/:taskId`, `POST /:id/{pause,resume,cancel}`, `POST /:id/tasks/:taskId/{approve,retry}`,
`GET /:id/messages`, `GET /:id/events`, `GET /:id/artifacts`, `GET /artifacts/:id/download`, `POST/GET/DELETE /api/fleet/uploads`, `GET /api/fleet/stats`.
Idempotency key on create. An auto-discovered route inventory test (as in Phase 2) proves each route requires a session **and** ownership.

## 9. Test plan (each layer verified, mutation-checked, reported with real numbers)
* **Repositories/state machine:** transition table, ownership matrix (user A × user B × every route/repository fn), event/state atomicity.
* **DAG & scheduler (fake agents + fake clock):** cycle/unknown-agent rejection, parallel vs sequential ordering, concurrency caps, retry/backoff, failure propagation, pause/resume/cancel, **crash recovery by killing the real server process mid-run and restarting**.
* **Worker (real pandas/sklearn here):** synthetic churn dataset with a fixed seed; metrics asserted against an independent recomputation from `predictions.csv`; resource-limit and timeout tests (infinite loop, memory bomb) against the real subprocess limits.
* **Uploads/downloads (real HTTP):** traversal filenames, double extensions, wrong magic bytes, NUL bytes, oversize, zip-bomb xlsx, CSV formula cells, cross-user download, tampered `stored_name`, header checks.
* **AI safety:** injection in dataset cells/column names/uploaded docs/research results stays inside untrusted blocks and cannot add tasks/agents/params outside the schema; fabricated-source and fabricated-metric rejection tests.
* **SSE:** auth, ownership, replay from `Last-Event-ID`, heartbeat, connection cap, terminal close. **Browser E2E** for the later UI.
* **Not testable here:** Docker build/run, real Gemini calls (including grounding), real Express/Vite (run locally per the verification doc).

## 10. Sub-phases and gates
| Step | Deliverable | Gate (must pass before the next) |
|---|---|---|
| 3a | migration 2, repositories, ownership matrix | unit + mutation |
| 3b | DAG validator, state machine, scheduler with fake agents, crash recovery | unit + real-process recovery test |
| 3c | Python worker, job protocol, `validate_dataset`/`eda`/`train` | real pandas/sklearn tests + limit tests |
| 3d | uploads/artifacts/downloads | real-HTTP security suite |
| 3e | six agents + validators (Gemini behind an interface; recorded fixtures for tests) | contract + injection tests |
| 3f | fleet routes + SSE | route inventory + two-user matrix + SSE tests |
| 3g | Dockerfile/compose + smoke script | static review here; your `docker compose` run |
The Fleet **UI** (dashboard, agent cards, workflow view, results workspace, history) follows as the next phase on top of these APIs.

## 11. Decisions needed from you
1. SQLite: proceed with node:sqlite now and re-evaluate better-sqlite3 on your image at the end (recommended)?
2. Upload limits: default 50 MB / 500k rows / 200 columns OK?
3. Software Agent: static validation only in this phase (recommended), or also sandboxed test execution of generated code?
4. Charts: JSON specs rendered with the existing Recharts (recommended) vs adding Plotly?
5. Research Agent: confirm your Gemini model/tier supports Google Search grounding (cost implications), and **confirm valid model IDs** – the existing defaults (`gemini-3.7-flash` …) could not be verified offline.
6. Production registration: keep open sign-up or invite-only (`ALLOW_REGISTRATION=false` after creating accounts)?
