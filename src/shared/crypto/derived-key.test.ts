import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { derivedSecret, keyLabel, MIN_SECRET_LENGTH, requireSessionSecret, WeakSecretError } from "./derived-key";

const env = (SESSION_SECRET?: string) => ({ NODE_ENV: "test", SESSION_SECRET }) as NodeJS.ProcessEnv;
const secret = "a".repeat(MIN_SECRET_LENGTH);

describe("derived keys", () => {
  it("refuses a missing or short SESSION_SECRET", () => {
    expect(() => requireSessionSecret(env())).toThrow(WeakSecretError);
    expect(() => requireSessionSecret(env("short-secret"))).toThrow(/at least 32/);
    expect(requireSessionSecret(env(secret))).toBe(secret);
  });

  it("gives every purpose its own key, none equal to the secret itself", () => {
    const keys = (["session", "sign-in-code", "rate-limit", "local-upload"] as const).map((p) => derivedSecret(p, env(secret)));
    expect(new Set(keys).size).toBe(4);
    expect(keys).not.toContain(secret);
  });

  it("matches the Web Crypto derivation session.ts uses", async () => {
    const master = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const webCrypto = Buffer.from(await crypto.subtle.sign("HMAC", master, new TextEncoder().encode(keyLabel("session")))).toString("hex");
    expect(derivedSecret("session", env(secret))).toBe(webCrypto);
    expect(derivedSecret("session", env(secret))).toBe(createHmac("sha256", secret).update("atunse:session").digest("hex"));
  });
});
