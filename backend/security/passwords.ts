/**
 * Password hashing with scrypt (Node built-in, memory-hard). Stored format:
 *   scrypt$N$r$p$<salt b64>$<hash b64>
 */
import { scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15; // 32 MiB at r=8
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const normalize = (pw: string) => pw.normalize("NFKC");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(normalize(password), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // Refuse absurd parameters (tampered rows must not become a CPU/memory DoS).
  const nOk = Number.isInteger(n) && n >= 2 ** 14 && n <= 2 ** 18 && (n & (n - 1)) === 0;
  if (!nOk || !Number.isInteger(r) || r < 1 || r > 16 || !Number.isInteger(p) || p < 1 || p > 4) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 16 || expected.length > 128) return false;
  const actual = await scryptAsync(normalize(password), salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;
/** Burns the same CPU as a real verification so unknown emails are not distinguishable by timing. */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
  await verifyPassword(password, await dummyHash);
}

const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwertyuiop", "1234567890", "12345678910",
  "iloveyou12", "administrator", "welcome123", "letmein123", "changeme123", "nexusai1234",
]);

/** NIST-style policy: length over composition rules, plus a small blocklist. */
export function validatePasswordPolicy(password: string, email = ""): string[] {
  const errors: string[] = [];
  if (typeof password !== "string") return ["Password is required"];
  const pw = normalize(password);
  if (pw.length < 10) errors.push("Password must be at least 10 characters");
  if (pw.length > 128) errors.push("Password must be at most 128 characters");
  if (/^(.)\1+$/.test(pw)) errors.push("Password must not be a single repeated character");
  if (COMMON.has(pw.toLowerCase())) errors.push("Password is too common");
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) {
    errors.push("Password must not contain your email name");
  }
  return errors;
}
