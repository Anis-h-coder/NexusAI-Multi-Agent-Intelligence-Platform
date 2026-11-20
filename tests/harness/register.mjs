// Test-only module-resolution hook: redirects the three third-party imports of server.ts to local stubs
// so the REAL server.ts can be loaded where npm packages are unavailable. NOT a substitute for real Express tests.
import { register } from "node:module";
register("./hooks.mjs", import.meta.url);
