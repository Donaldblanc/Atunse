import { hkdfSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  derivedKeyBytes,
  derivedSecret,
  HKDF_SALT,
  KEY_PURPOSES,
  keyLabel,
  requireSessionSecret,
  WeakSecretError,
} from "./derived-key";

const env = (SESSION_SECRET?: string) => ({ NODE_ENV: "test", SESSION_SECRET }) as NodeJS.ProcessEnv;
const secret = "3f9a1c7e5b2d8f4a6c0e9b1d7f3a5c8e2b4d6f8a0c1e3b5d7f9a2c4e6b8d0f1a";

describe("derived keys (HKDF-SHA256, versioned purposes)", () => {
  it("fails fast on a missing, short or placeholder master secret", () => {
    expect(() => requireSessionSecret(env())).toThrow(WeakSecretError);
    expect(() => requireSessionSecret(env("short-secret"))).toThrow(/at least 32/);
    expect(() => requireSessionSecret(env("a".repeat(64)))).toThrow(/placeholder/);
    expect(() => requireSessionSecret(env("abababababababababababababababab"))).toThrow(/placeholder/);
    expect(requireSessionSecret(env(secret))).toBe(secret);
    expect(() => derivedSecret("session", env("short"))).toThrow(WeakSecretError);
  });

  it("labels keys by purpose and version, e.g. atunse/session/v1", () => {
    expect(keyLabel("session")).toBe("atunse/session/v1");
    expect(keyLabel("rate-limit", 2)).toBe("atunse/rate-limit/v2");
    expect(() => keyLabel("session", 0)).toThrow();
  });

  it("derives the same key for the same purpose and version, every time", () => {
    expect(derivedSecret("session", env(secret))).toBe(derivedSecret("session", env(secret)));
    expect(derivedSecret("session", env(secret))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derives a different key for every purpose and version, none equal to the secret", () => {
    const keys = KEY_PURPOSES.flatMap((p) => [derivedSecret(p, env(secret), 1), derivedSecret(p, env(secret), 2)]);
    expect(new Set(keys).size).toBe(KEY_PURPOSES.length * 2);
    expect(keys).not.toContain(secret);
    expect(derivedSecret("session", env(secret))).not.toBe(derivedSecret("session", env(secret.replace("3", "4"))));
  });

  it("is standard HKDF, and the Web Crypto version session.ts uses gives identical bytes", async () => {
    const expected = Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, "atunse/session/v1", 32)).toString("hex");
    expect(derivedSecret("session", env(secret))).toBe(expected);
    for (const purpose of KEY_PURPOSES) {
      const webCrypto = Buffer.from(await derivedKeyBytes(purpose, env(secret))).toString("hex");
      expect(webCrypto).toBe(derivedSecret(purpose, env(secret)));
    }
  });
});
