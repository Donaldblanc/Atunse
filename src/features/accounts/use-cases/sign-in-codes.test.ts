import { describe, expect, it } from "vitest";
import { RecordingNotificationService } from "@/features/orders/use-cases/test-fixtures";
import { InMemoryAccountRepository, InMemorySignInCodeRepository } from "../repositories/in-memory-repositories";
import { MAX_CODES_PER_WINDOW } from "../sign-in-codes";
import { requestSignInCode, TooManyCodeRequestsError } from "./request-sign-in-code";
import { InvalidSignInCodeError, verifySignInCode } from "./verify-sign-in-code";

function setup() {
  let now = new Date("2026-10-01T15:00:00Z");
  const accounts = new InMemoryAccountRepository();
  accounts.add({ id: "acc_customer", role: "CUSTOMER", email: "jordan@example.com" });
  accounts.add({ id: "acc_admin", role: "ADMIN", email: "owner@example.com" });
  const codes = new InMemorySignInCodeRepository(() => now);
  const notifications = new RecordingNotificationService();
  let nextCode = 123456;
  const deps = {
    accounts,
    codes,
    notifications,
    secret: "test-secret",
    now: () => now,
    generateCode: () => String(nextCode++),
  };
  return { deps, codes, notifications, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

describe("requestSignInCode", () => {
  it("emails a code to a Customer Account and stores only its hash", async () => {
    const { deps, codes, notifications } = setup();
    await requestSignInCode(deps, " Jordan@Example.com ");

    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]).toMatchObject({ to: "jordan@example.com", subject: "123456 is your Atunṣe sign-in code" });
    expect(codes.codes).toHaveLength(1);
    expect(codes.codes[0]!.codeHash).not.toContain("123456");
  });

  it("silently does nothing for unknown emails and Admin Accounts", async () => {
    const { deps, codes, notifications } = setup();
    await requestSignInCode(deps, "nobody@example.com");
    await requestSignInCode(deps, "owner@example.com");
    expect(notifications.sent).toHaveLength(0);
    expect(codes.codes).toHaveLength(0);
  });

  it("limits how many codes an account can request per window", async () => {
    const { deps, advance } = setup();
    for (let i = 0; i < MAX_CODES_PER_WINDOW; i++) await requestSignInCode(deps, "jordan@example.com");
    await expect(requestSignInCode(deps, "jordan@example.com")).rejects.toThrow(TooManyCodeRequestsError);

    advance(16 * 60_000);
    await expect(requestSignInCode(deps, "jordan@example.com")).resolves.toBeUndefined();
  });
});

describe("verifySignInCode", () => {
  it("signs in with the latest code, once", async () => {
    const { deps } = setup();
    await requestSignInCode(deps, "jordan@example.com");

    await expect(verifySignInCode(deps, "JORDAN@example.com", "123456")).resolves.toEqual({ accountId: "acc_customer" });
    await expect(verifySignInCode(deps, "jordan@example.com", "123456")).rejects.toThrow(InvalidSignInCodeError);
  });

  it("only accepts the most recently requested code", async () => {
    const { deps } = setup();
    await requestSignInCode(deps, "jordan@example.com"); // 123456
    await requestSignInCode(deps, "jordan@example.com"); // 123457
    await expect(verifySignInCode(deps, "jordan@example.com", "123456")).rejects.toThrow(InvalidSignInCodeError);
    await expect(verifySignInCode(deps, "jordan@example.com", "123457")).resolves.toBeDefined();
  });

  it("rejects an expired code", async () => {
    const { deps, advance } = setup();
    await requestSignInCode(deps, "jordan@example.com");
    advance(10 * 60_000);
    await expect(verifySignInCode(deps, "jordan@example.com", "123456")).rejects.toThrow(InvalidSignInCodeError);
  });

  it("locks the code after five wrong guesses, even if the sixth is right", async () => {
    const { deps } = setup();
    await requestSignInCode(deps, "jordan@example.com");
    for (let i = 0; i < 5; i++) {
      await expect(verifySignInCode(deps, "jordan@example.com", "000000")).rejects.toThrow(InvalidSignInCodeError);
    }
    await expect(verifySignInCode(deps, "jordan@example.com", "123456")).rejects.toThrow(/Too many wrong codes/);
  });

  it("never signs in an Admin Account or an unknown email", async () => {
    const { deps } = setup();
    await expect(verifySignInCode(deps, "owner@example.com", "123456")).rejects.toThrow(InvalidSignInCodeError);
    await expect(verifySignInCode(deps, "nobody@example.com", "123456")).rejects.toThrow(InvalidSignInCodeError);
  });
});
