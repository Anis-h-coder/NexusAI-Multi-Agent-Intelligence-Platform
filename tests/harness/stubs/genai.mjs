// Records every model call; behaviour is supplied per test via globalThis.__gemini.
export class GoogleGenAI {
  constructor(opts) { this.opts = opts; }
  models = {
    generateContent: async (args) => {
      (globalThis.__geminiCalls ??= []).push(args);
      const h = globalThis.__gemini;
      if (!h) throw new Error("no gemini handler set");
      return h(args);
    },
  };
}
