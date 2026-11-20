const MAP = {
  express: "./stubs/express.mjs",
  "@google/genai": "./stubs/genai.mjs",
  dotenv: "./stubs/dotenv.mjs",
};
export async function resolve(specifier, context, nextResolve) {
  if (MAP[specifier]) return { url: new URL(MAP[specifier], import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
