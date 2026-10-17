import { randomBytes, scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, MISSING_ACCOUNT_PASSWORD_HASH, passwordNeedsRehash, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("keeps the event loop free while hashing (async scrypt)", async () => {
    let ticked = false;
    setImmediate(() => (ticked = true));
    const pending = hashPassword("anything");
    await new Promise((r) => setImmediate(r));
    expect(ticked).toBe(true);
    await pending;
  });

  it("has a fixed, valid dummy hash for missing accounts that nothing matches", async () => {
    expect(MISSING_ACCOUNT_PASSWORD_HASH).toMatch(/^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await verifyPassword("", MISSING_ACCOUNT_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword("password", MISSING_ACCOUNT_PASSWORD_HASH)).toBe(false);
  });

  it("stores the cost in the hash string and does not flag a fresh hash for rehash", async () => {
    const hash = await hashPassword("pw-one-two");
    expect(hash).toMatch(/^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(passwordNeedsRehash(hash)).toBe(false);
  });

  it("still verifies the legacy salt:hash format (Node defaults) and flags it for rehash", async () => {
    const salt = randomBytes(16);
    const legacy = `${salt.toString("hex")}:${scryptSync("old-password", salt, 64).toString("hex")}`;
    expect(await verifyPassword("old-password", legacy)).toBe(true);
    expect(await verifyPassword("nope", legacy)).toBe(false);
    expect(passwordNeedsRehash(legacy)).toBe(true);
  });

  it("rejects malformed current-format hashes without throwing", async () => {
    expect(await verifyPassword("x", "scrypt$131072$8$1$zz$zz")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1073741824$8$1$aa$bb")).toBe(false);
  });

});
