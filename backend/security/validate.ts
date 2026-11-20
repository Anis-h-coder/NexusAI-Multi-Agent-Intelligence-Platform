/**
 * Tiny dependency-free schema validator for request bodies.
 * - Unknown object keys are dropped (never forwarded to prompts or handlers).
 * - Strings are length-bounded and NUL/control characters are stripped.
 * - Error messages never echo the offending value.
 */
import type { Middleware } from "./http-types.ts";

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };
export type Schema<T = any> = (input: unknown, path: string) => Result<T>;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (path: string, msg: string): Result<never> => ({ ok: false, errors: [`${path}: ${msg}`] });
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export interface StringOpts { min?: number; max: number; pattern?: RegExp; trim?: boolean; optional?: boolean; }

export function string(o: StringOpts): Schema<string | undefined> {
  return (input, path) => {
    if (input === undefined || input === null) return o.optional ? ok(undefined) : fail(path, "is required");
    if (typeof input !== "string") return fail(path, "must be a string");
    let s = input.replace(CONTROL, "");
    if (o.trim !== false) s = s.trim();
    if (o.optional && s.length === 0) return ok(undefined);
    if (s.length < (o.min ?? 1)) return fail(path, "is too short");
    if (s.length > o.max) return fail(path, `must be at most ${o.max} characters`);
    if (o.pattern && !o.pattern.test(s)) return fail(path, "has an invalid format");
    return ok(s);
  };
}

export function oneOf<T extends string>(values: readonly T[], o: { optional?: boolean } = {}): Schema<T | undefined> {
  return (input, path) => {
    if (input === undefined || input === null) return o.optional ? ok(undefined) : fail(path, "is required");
    return typeof input === "string" && (values as readonly string[]).includes(input) ? ok(input as T) : fail(path, "is not an allowed value");
  };
}

export function array<T>(item: Schema<T>, o: { max: number; optional?: boolean }): Schema<T[] | undefined> {
  return (input, path) => {
    if (input === undefined || input === null) return o.optional ? ok(undefined) : fail(path, "is required");
    if (!Array.isArray(input)) return fail(path, "must be an array");
    if (input.length > o.max) return fail(path, `must have at most ${o.max} items`);
    const out: T[] = [];
    const errors: string[] = [];
    input.forEach((el, i) => {
      const r = item(el, `${path}[${i}]`);
      if (r.ok) out.push(r.value as T);
      else errors.push(...r.errors);
    });
    return errors.length ? { ok: false, errors } : ok(out);
  };
}

export function object<S extends Record<string, Schema>>(shape: S, o: { optional?: boolean } = {}): Schema<any> {
  return (input, path) => {
    if (input === undefined || input === null) return o.optional ? ok(undefined) : fail(path, "is required");
    if (typeof input !== "object" || Array.isArray(input)) return fail(path, "must be an object");
    const out: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const key of Object.keys(shape)) {
      const r = shape[key]((input as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
      if (!r.ok) errors.push(...r.errors);
      else if (r.value !== undefined) out[key] = r.value;
    }
    return errors.length ? { ok: false, errors } : ok(out);
  };
}

/** Array of flat records with primitive values (dataset sample rows). Bounded in rows, keys, and value size. */
export function rows(o: { maxRows: number; maxKeys: number; maxString: number; optional?: boolean }): Schema<Record<string, string | number | boolean | null>[] | undefined> {
  return (input, path) => {
    if (input === undefined || input === null) return o.optional ? ok(undefined) : fail(path, "is required");
    if (!Array.isArray(input)) return fail(path, "must be an array");
    if (input.length > o.maxRows) return fail(path, `must have at most ${o.maxRows} rows`);
    const out: Record<string, string | number | boolean | null>[] = [];
    for (let i = 0; i < input.length; i++) {
      const row = input[i];
      if (!row || typeof row !== "object" || Array.isArray(row)) return fail(`${path}[${i}]`, "must be an object");
      const keys = Object.keys(row);
      if (keys.length > o.maxKeys) return fail(`${path}[${i}]`, `has too many columns (max ${o.maxKeys})`);
      const clean: Record<string, string | number | boolean | null> = Object.create(null);
      for (const k of keys) {
        if (k === "__proto__" || k.length > 128) return fail(`${path}[${i}]`, "has an invalid column name");
        const v = (row as Record<string, unknown>)[k];
        if (v === null || typeof v === "boolean") clean[k] = v;
        else if (typeof v === "number") { if (!Number.isFinite(v)) return fail(`${path}[${i}].${k}`, "must be finite"); clean[k] = v; }
        else if (typeof v === "string") clean[k] = v.replace(CONTROL, "").slice(0, o.maxString);
        else return fail(`${path}[${i}].${k}`, "must be a primitive value");
      }
      out.push({ ...clean });
    }
    return ok(out);
  };
}

export function parse<T>(schema: Schema<T>, input: unknown): Result<T> {
  return schema(input, "");
}

/** Express-style middleware: replaces req.body with the sanitised value or responds 400. */
export function validateBody(schema: Schema): Middleware {
  return (req, res, next) => {
    const r = schema(req.body ?? {}, "");
    if (!r.ok) {
      res.status(400).json({ error: "Invalid request", details: r.errors.slice(0, 10).map((e) => e.replace(/^: /, "")) });
      return;
    }
    req.body = r.value ?? {};
    next();
  };
}

export const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
/** Column labels may come from CSV headers: allow common characters but no quotes, semicolons or backticks. */
export const SAFE_COLUMN_LABEL = /^[\p{L}\p{N}_ .\-()%/#]{1,64}$/u;
