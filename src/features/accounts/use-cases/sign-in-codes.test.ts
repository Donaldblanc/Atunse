import { describe, expect, it } from "vitest";
import { submitOrder } from "@/features/orders/use-cases/submit-order";
import { bookingDeps, RecordingNotificationService, validBookingInput } from "@/features/orders/use-cases/test-fixtures";
import { InMemoryAccounts, InMemorySignInCodes } from "../repositories/in-memory-repositories";
import { MAX_CODES_PER_WINDOW, MAX_GUESSES_PER_DAY } from "../sign-in-codes";
import { requestSignInCode } from "./request-sign-in-code";
import { InvalidSignInCodeError, verifySignInCode } from "./verify-sign-in-code";

function setup(accounts = new InMemoryAccounts()) {
  let now = new Date("2026-10-01T15:00:00Z");
  if (!accounts.accounts.length) {
    accounts.add({ id: "acc_customer", role: "CUSTOMER", email: "jordan@example.com" });
    accounts.add({ id: "acc_admin", role: "ADMIN", email: "owner@example.com" });
  }
  let nextCode = 123456;
  const codes = new InMemorySignInCodes("test-secret", () => String(nextCode++));
  const notifications = new RecordingNotificationService();
  const deps = { accounts, codes, notifications, now: () => now };
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

  it("sends nothing for unknown emails and Admin-only emails, silently", async () => {
    const { deps, notifications } = setup();
    await expect(requestSignInCode(deps, "nobody@example.com")).resolves.toBeUndefined();
    await expect(requestSignInCode(deps, "owner@example.com")).resolves.toBeUndefined();
    expect(notifications.sent).toHaveLength(0);
  });

  it("stops sending when rate-limited, without answering any differently", async () => {
    const { deps, notifications, advance } = setup();
    for (let i = 0; i < MAX_CODES_PER_WINDOW + 2; i++) {
      await expect(requestSignInCode(deps, "jordan@example.com")).resolves.toBeUndefined();
    }
    expect(notifications.sent).toHaveLength(MAX_CODES_PER_WINDOW);

    advance(16 * 60_000);
    await requestSignInCode(deps, "jordan@example.com");
    expect(notifications.sent).toHaveLength(MAX_CODES_PER_WINDOW + 1);
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

  it("caps guesses per account per day, across fresh codes and windows", async () => {
    const { deps, advance, notifications } = setup();
    let guesses = 0;
    while (guesses < MAX_GUESSES_PER_DAY) {
      await requestSignInCode(deps, "jordan@example.com");
      for (let i = 0; i < 5 && guesses < MAX_GUESSES_PER_DAY; i++, guesses++) {
        await verifySignInCode(deps, "jordan@example.com", "000000").catch(() => undefined);
      }
      advance(16 * 60_000); // past the per-window code limit
    }

    // Locked for the day: no new code goes out, and even a real code is refused.
    const sentBefore = notifications.sent.length;
    await requestSignInCode(deps, "jordan@example.com");
    expect(notifications.sent).toHaveLength(sentBefore);
    await expect(verifySignInCode(deps, "jordan@example.com", "123456")).rejects.toThrow(/Too many wrong codes/);

    advance(24 * 60 * 60_000);
    await requestSignInCode(deps, "jordan@example.com");
    expect(notifications.sent).toHaveLength(sentBefore + 1);
  });

  it("never signs in an Admin-only email or an unknown email", async () => {
    const { deps } = setup();
    await expect(verifySignInCode(deps, "owner@example.com", "123456")).rejects.toThrow(InvalidSignInCodeError);
    await expect(verifySignInCode(deps, "nobody@example.com", "123456")).rejects.toThrow(InvalidSignInCodeError);
  });
});

describe("book → sign in → rebook (one shared accounts table)", () => {
  it("a customer created by booking can sign in with a code and book again into the same Account", async () => {
    const booking = bookingDeps({ customerSignInEnabled: true });
    const first = await submitOrder(booking, { accountId: null, role: "GUEST" }, validBookingInput());

    const { deps } = setup(booking.accounts);
    await requestSignInCode(deps, "customer@example.com");
    const { accountId } = await verifySignInCode(deps, "customer@example.com", "123456");
    expect(accountId).toBe(first.accountId);

    const again = validBookingInput();
    again.item = { ...again.item, photoKeys: ["bookings/0b6e8c1e-3f7a-4c2d-9e1b-5a4f3c2d1e0f/1.jpg"] };
    const second = await submitOrder(booking, { accountId, role: "CUSTOMER" }, again);
    expect(second.accountId).toBe(first.accountId);
  });
});
