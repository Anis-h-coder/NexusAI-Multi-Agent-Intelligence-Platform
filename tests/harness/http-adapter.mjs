/**
 * Bridges the harness router (stubs/express.mjs) to a real node:http server so the REAL server.ts handlers run over
 * real TCP sockets: real Set-Cookie/Cookie headers, real req.ip, real 413/400 body errors, real CORS preflights and a
 * browser that actually enforces the CSP/CORS/SameSite rules.
 * NOT real Express: routing, static file serving, ETags and the HTTP parser's edge cases are not Express's.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".map": "application/json" };

export function createHttpServer(app, { staticDir } = {}) {
  const globalHeaders = app.stack[0]?.handlers?.[0]; // securityHeaders(): first app.use() in server.ts

  return http.createServer(async (nreq, nres) => {
    const url = nreq.url ?? "/";
    const ip = String(nreq.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
    const req = { method: nreq.method, originalUrl: url, url, headers: nreq.headers, ip, body: undefined, rawBody: undefined };

    const res = {
      ended: false,
      get statusCode() { return nres.statusCode; },
      set statusCode(v) { nres.statusCode = v; },
      get headersSent() { return nres.headersSent; },
      setHeader(n, v) { nres.setHeader(n, v); },
      removeHeader(n) { nres.removeHeader(n); },
      status(c) { nres.statusCode = c; return res; },
      json(b) { if (!nres.getHeader("content-type")) nres.setHeader("Content-Type", "application/json; charset=utf-8"); res.ended = true; nres.end(JSON.stringify(b)); },
      end(b) { res.ended = true; nres.end(b); },
    };

    if (!url.startsWith("/api")) {
      // Static page: apply the same global security headers (incl. CSP) the real app sets, then serve the file.
      if (globalHeaders) await new Promise((r) => globalHeaders(req, res, r));
      if (!staticDir) { nres.statusCode = 404; nres.end(); return; }
      const clean = decodeURIComponent(url.split("?")[0]);
      let file = path.join(staticDir, clean === "/" ? "index.html" : clean);
      if (!file.startsWith(path.resolve(staticDir))) { nres.statusCode = 403; nres.end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, "index.html"); // SPA fallback
      nres.setHeader("Content-Type", MIME[path.extname(file)] ?? "application/octet-stream");
      nres.end(fs.readFileSync(file));
      return;
    }

    const chunks = [];
    let size = 0;
    for await (const c of nreq) { size += c.length; if (size <= 40 * 1024 * 1024) chunks.push(c); }
    req.rawBody = Buffer.concat(chunks);
    try {
      await app.handle(req, res);
    } catch (e) {
      if (!res.ended) { nres.statusCode = 500; nres.end(JSON.stringify({ error: "harness failure", detail: String(e?.message ?? e) })); }
    }
    if (!res.ended && !nres.writableEnded) nres.end();
  });
}
