// The account lookups and code guards must hold in the database itself,
// under concurrency, not just in the in-memory doubles. Run with
// `npm run test:integration` (against a throwaway database).

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_CODE_ATTEMPTS, MAX_GUESSES_PER_DAY } from "../sign-in-codes";
import { PrismaAccountRepository } from "./prisma-account-repository";
import { PrismaSignInCodes } from "./prisma-sign-in-codes";

const prisma = new PrismaClient();
const accounts = new PrismaAccountRepository(prisma);
let nextCode = 111111;
const codes = new PrismaSignInCodes(prisma, "test-secret", () => String(nextCode++));
let customerId: string;
let adminId: string;

beforeEach(async () => {
  await prisma.signInCode.deleteMany();
  await prisma.itemAuditEntry.deleteMany();
  await prisma.itemPhoto.deleteMany();
  await prisma.item.deleteMany();
  await prisma.order.deleteMany();
  await prisma.account.deleteMany({ where: { email: "codes@example.com" } });
  customerId = (await prisma.account.create({ data: { email: "codes@example.com", phone: "2125550142" } })).id;
  adminId = (await prisma.account.create({ data: { email: "codes@example.com", role: "ADMIN" } })).id;
});

afterAll(async () => {
  await prisma.signInCode.deleteMany();
  await prisma.account.deleteMany({ where: { email: "codes@example.com" } });
  await prisma.$disconnect();
});

describe("PrismaAccountRepository (integration)", () => {
  it("only ever returns the Customer Account, even when an Admin shares the email", async () => {
    expect(await accounts.findCustomerByEmail("  CODES@Example.com ")).toEqual({ id: customerId, email: "codes@example.com" });
    expect(await accounts.findCustomerById(customerId)).toEqual({ id: customerId, email: "codes@example.com" });
    expect(await accounts.findCustomerById(adminId)).toBeNull();
    expect(await accounts.findCustomerByEmail("nobody@example.com")).toBeNull();
  });
});

describe("PrismaSignInCodes (integration)", () => {
  it("issues a code and redeems it exactly once", async () => {
    const now = new Date();
    const issued = await codes.issue(customerId, now);
    if (!("code" in issued)) throw new Error("expected a code");
    expect(await codes.redeem(customerId, issued.code, now)).toBe("ok");
    expect(await codes.redeem(customerId, issued.code, now)).toBe("invalid");
  });

  it("counts at most the per-code limit of guesses, even when they arrive in parallel", async () => {
    const now = new Date();
    await codes.issue(customerId, now);
    const results = await Promise.all(Array.from({ length: 10 }, () => codes.redeem(customerId, "000000", now)));
    expect(results.filter((r) => r === "invalid")).toHaveLength(MAX_CODE_ATTEMPTS);
    expect(results.filter((r) => r === "locked")).toHaveLength(10 - MAX_CODE_ATTEMPTS);
  });

  it("redeems a correct code once when two verifications race", async () => {
    const now = new Date();
    const issued = await codes.issue(customerId, now);
    if (!("code" in issued)) throw new Error("expected a code");
    const results = await Promise.all([codes.redeem(customerId, issued.code, now), codes.redeem(customerId, issued.code, now)]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
  });

  it("stops issuing and redeeming after the daily guess cap, until the day rolls over", async () => {
    let now = new Date();
    let guesses = 0;
    while (guesses < MAX_GUESSES_PER_DAY) {
      await codes.issue(customerId, now);
      for (let i = 0; i < MAX_CODE_ATTEMPTS && guesses < MAX_GUESSES_PER_DAY; i++, guesses++) {
        await codes.redeem(customerId, "000000", now);
      }
      now = new Date(now.getTime() + 16 * 60_000);
    }
    expect(await codes.issue(customerId, now)).toEqual({ rateLimited: true });
    expect(await codes.redeem(customerId, "000000", now)).toBe("locked");

    now = new Date(now.getTime() + 25 * 60 * 60_000);
    expect("code" in (await codes.issue(customerId, now))).toBe(true);
  });
});
