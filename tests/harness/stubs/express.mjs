/**
 * Minimal Express-4-semantics router used ONLY by tests/integration/server-harness.test.ts.
 * Faithful to: registration order, prefix matching for use(), exact path matching for routes, error-handler arity (4),
 * synchronous throws -> error handlers, and (importantly) async rejections are NOT forwarded (Express 4 behaviour).
 * NOT modelled: body parsing, req.ip derivation, cookies on the wire, streaming, HTTP.
 */
function express() {
  const stack = [];
  const settings = {};
  const app = {
    stack, settings,
    disable(k) { settings[k] = false; },
    set(k, v) { settings[k] = v; },
    use(...args) {
      const path = typeof args[0] === "string" ? args.shift() : "/";
      stack.push({ kind: "use", path, handlers: args.flat() });
    },
    get(...args) {
      if (args.length === 1) return settings[args[0]];
      const path = args.shift();
      stack.push({ kind: "route", method: "GET", paths: [].concat(path), handlers: args.flat() });
    },
    post(path, ...handlers) { stack.push({ kind: "route", method: "POST", paths: [].concat(path), handlers: handlers.flat() }); },
    listen() { throw new Error("listen() is not available in the harness"); },

    /** Dispatches a fake request through the registered stack. Resolves when a response is ended or the stack is exhausted. */
    async handle(req, res) {
      const pathname = String(req.originalUrl).split("?")[0];
      let error = null;
      for (const layer of stack) {
        if (layer.kind === "use") {
          const ok = layer.path === "/" || pathname === layer.path || pathname.startsWith(layer.path + "/");
          if (!ok) continue;
        } else {
          if (layer.method !== req.method) continue;
          if (!layer.paths.some((p) => p === pathname || p === "*" || p === "/*")) continue;
        }
        for (const h of layer.handlers) {
          if (res.ended) return;
          const isErrHandler = h.length === 4;
          if (error && !isErrHandler) continue;
          if (!error && isErrHandler) continue;
          let nextCalled = false;
          let nextErr;
          const next = (e) => { nextCalled = true; nextErr = e; };
          try {
            const ret = isErrHandler ? h(error, req, res, next) : h(req, res, next);
            if (ret && typeof ret.then === "function") {
              // Express 4 does not catch async rejections; surface them so tests can fail loudly.
              ret.catch((e) => { (req.__unhandledRejections ??= []).push(e); if (!res.ended) res.json({ __harnessUnhandledRejection: String(e?.message ?? e) }); });
            }
          } catch (e) { error = e; continue; }
          // Wait until the handler ends the response or calls next() (handlers may finish asynchronously).
          const deadline = Date.now() + 8000;
          while (!res.ended && !nextCalled && Date.now() < deadline) await new Promise((r) => setTimeout(r, 1));
          if (res.ended) return;
          if (!nextCalled) { res.statusCode = 599; res.json({ __harnessTimeout: "handler neither responded nor called next()" }); return; }
          if (nextErr) error = nextErr; else if (isErrHandler) error = null;
        }
      }
      if (!res.ended) { res.statusCode = 404; res.json({ error: "harness: no route matched" }); }
    },
  };
  return app;
}
/** body-parser-compatible limit parsing ("16kb", "2mb", number of bytes). */
function parseLimit(v) {
  if (typeof v === "number") return v;
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(String(v ?? "100kb"));
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(m?.[2] ?? "b").toLowerCase()];
  return Math.floor(Number(m?.[1] ?? 102400) * mult);
}
/**
 * express.json(): when a raw HTTP body is attached (real-socket mode) it mirrors body-parser's observable behaviour:
 * 413 entity.too.large, 400 entity.parse.failed, strict (object/array only), req.body = {} when empty/non-JSON.
 * In in-process mode (no rawBody) it leaves a test-provided req.body untouched.
 */
express.json = (opts) => Object.assign((req, res, next) => {
  if (req.rawBody === undefined) return next();
  const limit = parseLimit(opts?.limit);
  const raw = req.rawBody;
  if (raw.length > limit) return next(Object.assign(new Error("request entity too large"), { type: "entity.too.large", status: 413, statusCode: 413 }));
  const ct = String(req.headers["content-type"] ?? "");
  if (raw.length === 0 || !/^application\/json/i.test(ct)) { req.body = {}; return next(); }
  const text = raw.toString("utf8");
  try {
    if (!/^[\s]*[\[{]/.test(text)) throw new SyntaxError("Unexpected token in JSON (strict mode)");
    req.body = JSON.parse(text);
  } catch (e) {
    return next(Object.assign(new Error(e.message), { type: "entity.parse.failed", status: 400, statusCode: 400 }));
  }
  next();
}, { __stub: "json", limit: opts?.limit });
express.static = (dir) => Object.assign((req, res, next) => next(), { __stub: "static", dir });
export default express;
