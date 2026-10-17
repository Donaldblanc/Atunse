// The account lookups and code guards must hold in the database itself,
// under concurrency, not just in the in-memory doubles. Run with
// `npm run test:integration` (against a throwaway database).

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_CODE_ATTEMPTS, MAX_GUESSES_PER_DAY } from "../sign-in-codes";
import { AdminEmailTakenError } from "./account-repository";
import { PrismaAccountRepository } from "./prisma-account-repository";
import { PrismaSignInCodes } from "./prisma-sign-in-codes";
import { deleteAllOrders } from "@/shared/testing/delete-all-orders";

const prisma = new PrismaClient();
const accounts = new PrismaAccountRepository(prisma);
let nextCode = 111111;
const codes = new PrismaSignInCodes(prisma, "test-secret", () => String(nextCode++));
let customerId: string;
let adminId: string;

beforeEach(async () => {
  await prisma.signInCode.deleteMany();
  await deleteAllOrders(prisma);
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

  it("lists only Customer Accounts, and returns a Customer's detail", async () => {
    const customers = await accounts.listCustomers();
    expect(customers.some((c) => c.id === adminId)).toBe(false);
    expect(customers.find((c) => c.id === customerId)).toMatchObject({ email: "codes@example.com", phone: "2125550142" });

    expect(await accounts.findCustomerDetail(customerId)).toMatchObject({ id: customerId, email: "codes@example.com", phone: "2125550142" });
    expect(await accounts.findCustomerDetail(adminId)).toBeNull();
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

  it("finds an Admin Account by id, never a Customer's", async () => {
    expect(await accounts.findAdminById(adminId)).toEqual({ id: adminId, name: null, email: "codes@example.com", passwordHash: null, sessionVersion: 0 });
    expect(await accounts.findAdminById(customerId)).toBeNull();
    expect(await accounts.findAdminById("no-such-id")).toBeNull();
  });

  it("updateAdminProfile changes the admin's name and lowercased email, never a Customer's", async () => {
    await accounts.updateAdminProfile(adminId, { name: "DJ", email: " Codes-New@Example.com " });
    expect(await accounts.findAdminById(adminId)).toMatchObject({ name: "DJ", email: "codes-new@example.com" });
    await accounts.updateAdminProfile(customerId, { name: "Hacked", email: "hacked@example.com" });
    expect(await prisma.account.findUnique({ where: { id: customerId } })).toMatchObject({ email: "codes@example.com", name: null });
    await prisma.account.deleteMany({ where: { email: "codes-new@example.com" } });
  });

  it("updateAdminProfile throws AdminEmailTakenError when another admin has the email", async () => {
    const otherId = (await prisma.account.create({ data: { email: "codes-other@example.com", role: "ADMIN" } })).id;
    try {
      await expect(accounts.updateAdminProfile(adminId, { name: "DJ", email: "codes-other@example.com" })).rejects.toThrow(AdminEmailTakenError);
      expect((await accounts.findAdminById(adminId))?.email).toBe("codes@example.com");
    } finally {
      await prisma.account.deleteMany({ where: { id: otherId } });
    }
  });

  it("updateAdminPasswordHash replaces the admin's hash only", async () => {
    await accounts.updateAdminPasswordHash(adminId, "hash-1");
    expect((await accounts.findAdminById(adminId))?.passwordHash).toBe("hash-1");
    await accounts.updateAdminPasswordHash(customerId, "hash-2");
    expect((await prisma.account.findUnique({ where: { id: customerId } }))?.passwordHash).toBeNull();
  });
});
