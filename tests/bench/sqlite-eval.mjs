// Reproducible evaluation of node:sqlite for this platform's workload. Run: node tests/bench/sqlite-eval.mjs
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath } from "node:url";

const me = fileURLToPath(import.meta.url);
const open = (f) => { const d = new DatabaseSync(f); d.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;"); return d; };
const ms = (t0) => Math.round(performance.now() - t0);

if (process.argv[2] === "writer") { // child: contention worker
  const [, , , file, id, n] = process.argv; const db = open(file); let errors = 0;
  const ins = db.prepare("INSERT INTO events (worker, seq, payload) VALUES (?,?,?)");
  for (let i = 0; i < Number(n); i++) { try { db.exec("BEGIN IMMEDIATE"); ins.run(Number(id), i, "x".repeat(200)); db.exec("COMMIT"); } catch (e) { errors++; try { db.exec("ROLLBACK"); } catch {} } }
  console.log(JSON.stringify({ errors })); process.exit(0);
}
if (process.argv[2] === "crasher") { // child: commits forever, reports each acknowledged commit
  const db = open(process.argv[3]); const ins = db.prepare("INSERT INTO ledger (v) VALUES (?)");
  for (let i = 1; ; i++) { db.exec("BEGIN IMMEDIATE"); ins.run(i); db.exec("COMMIT"); process.stdout.write(i + "\n"); }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite-eval-"));
const out = { node: process.version };
const db0 = open(path.join(dir, "a.db")); out.sqlite_version = db0.prepare("select sqlite_version() v").get().v;
db0.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, k TEXT, v INTEGER); CREATE TABLE events (id INTEGER PRIMARY KEY, worker INT, seq INT, payload TEXT); CREATE TABLE ledger (id INTEGER PRIMARY KEY, v INT)");

let t0 = performance.now(); db0.exec("BEGIN"); const ins = db0.prepare("INSERT INTO t (k, v) VALUES (?, ?)");
for (let i = 0; i < 100000; i++) ins.run("key" + i, i); db0.exec("COMMIT");
out.bulk_insert_100k_rows_ms = ms(t0);

t0 = performance.now(); const one = db0.prepare("INSERT INTO t (k, v) VALUES (?, ?)");
for (let i = 0; i < 5000; i++) one.run("auto" + i, i);
out.autocommit_inserts_5000_ms = ms(t0); out.autocommit_inserts_per_sec = Math.round(5000 / ((performance.now() - t0) / 1000));

t0 = performance.now(); const get = db0.prepare("SELECT v FROM t WHERE id = ?");
for (let i = 1; i <= 100000; i++) get.get(i);
out.point_reads_100k_ms = ms(t0);

t0 = performance.now(); const agg = db0.prepare("SELECT COUNT(*), SUM(v), AVG(v) FROM t WHERE k LIKE '%9%'").get();
out.full_scan_aggregate_105k_rows_ms = ms(t0);
{ // event-loop blocking while that scan runs
  let maxGap = 0, last = performance.now(); const iv = setInterval(() => { const n = performance.now(); maxGap = Math.max(maxGap, n - last); last = n; }, 5);
  await new Promise((r) => setTimeout(r, 30)); db0.prepare("SELECT COUNT(*), SUM(v) FROM t a JOIN (SELECT id FROM t LIMIT 3000) b ON a.id % 3000 = b.id % 3000").get();
  await new Promise((r) => setTimeout(r, 30)); clearInterval(iv); out.event_loop_stall_during_heavy_query_ms = Math.round(maxGap);
}

// multi-process write contention: 4 OS processes x 1500 transactions on one file
t0 = performance.now(); const file = path.join(dir, "a.db");
const results = await Promise.all([1, 2, 3, 4].map((id) => new Promise((res) => { const c = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", me, "writer", file, String(id), "1500"]); let o = ""; c.stdout.on("data", (d) => (o += d)); c.on("exit", () => res(JSON.parse(o || '{"errors":-1}'))); })));
const counted = db0.prepare("SELECT COUNT(*) c FROM events").get().c;
out.contention_4proc_x1500_ms = ms(t0); out.contention_errors = results.reduce((a, r) => a + r.errors, 0); out.contention_rows_expected = 6000; out.contention_rows_actual = counted;

// crash recovery: SIGKILL a writer mid-stream, reopen, verify integrity + durability of acknowledged commits
const kfile = path.join(dir, "a.db"); let lastAck = 0;
const crasher = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", me, "crasher", kfile]);
crasher.stdout.on("data", (d) => { const ls = String(d).trim().split("\n"); lastAck = Number(ls[ls.length - 1]) || lastAck; });
await new Promise((r) => setTimeout(r, 800)); crasher.kill("SIGKILL"); await new Promise((r) => crasher.on("exit", r));
const db2 = open(kfile);
out.crash_integrity_check = db2.prepare("PRAGMA integrity_check").get().integrity_check;
const maxRow = db2.prepare("SELECT MAX(v) m, COUNT(*) c, MIN(v) lo FROM ledger").get();
out.crash_rows_contiguous_no_gaps = maxRow.lo === 1 && maxRow.c === maxRow.m; // every commit before the kill is present, in order
out.crash_last_acknowledged_commit = lastAck; out.crash_max_row_after_recovery = maxRow.m; out.crash_no_acknowledged_commit_lost = maxRow.m >= lastAck; // weak: ack lag from pipe buffering; see contiguity check
out.wal_file_present = fs.existsSync(kfile + "-wal");
console.log(JSON.stringify(out, null, 2));
fs.rmSync(dir, { recursive: true, force: true });
