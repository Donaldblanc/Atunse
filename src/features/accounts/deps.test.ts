import { describe, expect, it } from "vitest";
import { buildSignInCodeDeps, SignInUnavailableError } from "./deps";

describe("buildSignInCodeDeps", () => {
  it("fails closed in production without real email delivery, so codes never go to the logs", () => {
    expect(() => buildSignInCodeDeps({ NODE_ENV: "production", SESSION_SECRET: "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef" })).toThrow(SignInUnavailableError);
    expect(() =>
      buildSignInCodeDeps({ NODE_ENV: "production", SESSION_SECRET: "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef", RESEND_API_KEY: "re_key" }),
    ).toThrow(SignInUnavailableError);
  });

  it("builds in production once Resend is configured, and in development without it", () => {
    expect(
      buildSignInCodeDeps({ NODE_ENV: "production", SESSION_SECRET: "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef", RESEND_API_KEY: "re_key", EMAIL_FROM: "a@b.co" }),
    ).toBeDefined();
    expect(buildSignInCodeDeps({ NODE_ENV: "development", SESSION_SECRET: "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef" })).toBeDefined();
  });

  it("refuses to run without the secret that keys the code hashes", () => {
    expect(() => buildSignInCodeDeps({ NODE_ENV: "development" })).toThrow(SignInUnavailableError);
  });
});
