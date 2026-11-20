// Starts the REAL server.ts behind the HTTP bridge. Usage (from repo root):
//   node --experimental-strip-types --import ./tests/harness/register.mjs tests/e2e/shim-server.mjs
// Env: SHIM_PORT (0 = random), DATA_DIR, STATIC_DIR, plus every normal server env var.
import { createHttpServer } from "../harness/http-adapter.mjs";

process.env.GEMINI_API_KEY ??= "AIza" + "T".repeat(35);
const app = (await import("../../server.ts")).default;
const server = createHttpServer(app, { staticDir: process.env.STATIC_DIR });
server.listen(Number(process.env.SHIM_PORT ?? 0), "127.0.0.1", () => {
  console.log("LISTENING " + server.address().port);
});
const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
