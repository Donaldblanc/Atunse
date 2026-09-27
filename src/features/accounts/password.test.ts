import { describe, expect, it } from "vitest";
import { hashPassword, passwordHashForMissingAccount, verifyPassword } from "./password";

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

  it("offers one real, reusable hash for checking guesses against a missing account", async () => {
    const dummy = await passwordHashForMissingAccount();
    expect(dummy).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await passwordHashForMissingAccount()).toBe(dummy);
    expect(await verifyPassword("anything", dummy)).toBe(false);
  });
});
