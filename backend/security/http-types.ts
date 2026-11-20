/** Minimal structural types so middleware is framework-agnostic and unit-testable without Express installed. */
import type { AuthContext } from "./sessions.ts";

export interface Req {
  method: string;
  path?: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  body?: any;
  auth?: AuthContext;
  id?: string;
}
export interface Res {
  statusCode: number;
  headersSent?: boolean;
  setHeader(name: string, value: string | number | readonly string[]): unknown;
  removeHeader?(name: string): unknown;
  status(code: number): Res;
  json(body: unknown): unknown;
  end(body?: unknown): unknown;
}
export type Next = (err?: unknown) => void;
export type Middleware = (req: Req, res: Res, next: Next) => void | Promise<void>;

export const header = (req: Req, name: string): string | undefined => {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
};
export const isUnsafeMethod = (m: string) => !["GET", "HEAD", "OPTIONS"].includes(m.toUpperCase());
