import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "../../backend/security/passwords.ts";

test("hash is salted, not plaintext, and verifies", async () => {
  const a = await hashPassword("correct horse battery staple");
  const b = await hashPassword("correct horse battery staple");
  assert.notEqual(a, b, "salts must differ");
  assert.ok(a.startsWith("scrypt$32768$8$1$"));
  assert.ok(!a.includes("correct horse"));
  assert.equal(await verifyPassword("correct horse battery staple", a), true);
  assert.equal(await verifyPassword("correct horse battery stapl", a), false);
});

test("verifyPassword rejects malformed or tampered hashes without throwing", async () => {
  for (const bad of ["", "plain", "scrypt$1$1$1$AA$AA", "scrypt$32768$8$1$AAAA", "bcrypt$x$y$z$a$b", "scrypt$1073741824$8$1$AAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAA"]) {
    assert.equal(await verifyPassword("whatever-password", bad), false, `should reject: ${bad}`);
  }
});

test("unicode normalisation: equivalent forms verify", async () => {
  const h = await hashPassword("pässwörd-long-enough");
  assert.equal(await verifyPassword("pa\u0308sswo\u0308rd-long-enough", h), true);
});

test("password policy", () => {
  assert.deepEqual(validatePasswordPolicy("a-very-long-passphrase", "bob@example.com"), []);
  assert.ok(validatePasswordPolicy("short", "a@b.co").length > 0);
  assert.ok(validatePasswordPolicy("x".repeat(129), "a@b.co").some((e) => /at most 128/.test(e)));
  assert.ok(validatePasswordPolicy("aaaaaaaaaaaa", "a@b.co").length > 0);
  assert.ok(validatePasswordPolicy("Password123", "a@b.co").length > 0);
  assert.ok(validatePasswordPolicy("my-alexander-pw1", "alexander@example.com").some((e) => /email/.test(e)));
});
