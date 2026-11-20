/**
 * Bundles the REAL React app (src/App.tsx + all components) with esbuild for browser E2E.
 * Only packages that are not installed are replaced by inert stubs (icons, charts, markdown, PDF); their exports are
 * generated from what src/ actually imports. This is NOT the production Vite build and does not process Tailwind CSS.
 * Usage: node tests/e2e/build-bundle.mjs <outDir>   (env: ESBUILD_MODULE, E2E_NODE_PATH to resolve react/esbuild offline)
 */
import fs from "node:fs";
import path from "node:path";

export async function buildBundle(outDir) {
  const esbuild = await import(process.env.ESBUILD_MODULE ?? "esbuild");
  const STUBBED = ["lucide-react", "recharts", "react-markdown", "remark-gfm", "jspdf"];
  const named = Object.fromEntries(STUBBED.map((p) => [p, new Set()]));
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []);
  for (const f of walk("src")) {
    const s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/import\s+(?!type\b)([^;]*?)\s+from\s+['"]([^'"]+)['"]/gs)) {
      if (!STUBBED.includes(m[2])) continue;
      const brace = /\{([^}]*)\}/.exec(m[1]);
      if (brace) for (const n of brace[1].split(",")) { const t = n.trim(); if (t && !t.startsWith("type ")) named[m[2]].add(t.split(/\s+as\s+/)[0].trim()); }
    }
  }
  const stubDir = path.join(outDir, "stubs");
  fs.mkdirSync(stubDir, { recursive: true });
  const comp = (n) => `export const ${n} = (props) => (props && props.children !== undefined ? props.children : null);\n`;
  const files = {
    "lucide-react": [...named["lucide-react"]].map((n) => `export const ${n} = () => null;\n`).join(""),
    recharts: [...named.recharts].map(comp).join(""),
    "react-markdown": `export default function ReactMarkdown(props){ return props.children ?? null; }\n`,
    "remark-gfm": `export default function remarkGfm(){}\n`,
    jspdf: `export class jsPDF { constructor(){ throw new Error("jsPDF stub: PDF export is not available in the E2E bundle"); } }\n`,
  };
  const alias = {};
  for (const [pkg, code] of Object.entries(files)) {
    const p = path.join(stubDir, pkg.replace(/\W/g, "_") + ".js");
    fs.writeFileSync(p, code);
    alias[pkg] = path.resolve(p);
  }
  fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
  const result = await esbuild.build({
    entryPoints: ["tests/e2e/app-entry.tsx"],
    bundle: true, format: "esm", platform: "browser", target: "es2022", jsx: "automatic", minify: false, sourcemap: false,
    outfile: path.join(outDir, "assets", "app.js"), alias, loader: { ".css": "empty" },
    nodePaths: process.env.E2E_NODE_PATH ? [process.env.E2E_NODE_PATH] : [],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent", metafile: true,
  });
  fs.writeFileSync(path.join(outDir, "index.html"), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>NexusAI e2e</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>');
  return { warnings: result.warnings.length, inputs: Object.keys(result.metafile.inputs).length, stubbed: Object.fromEntries(Object.entries(named).map(([k, v]) => [k, v.size])) };
}

if (process.argv[1]?.endsWith("build-bundle.mjs")) {
  buildBundle(process.argv[2] ?? "/tmp/nexus-e2e-static").then((r) => console.log("bundle ok", JSON.stringify(r)), (e) => { console.error("BUNDLE FAILED:\n" + e.message); process.exit(1); });
}
