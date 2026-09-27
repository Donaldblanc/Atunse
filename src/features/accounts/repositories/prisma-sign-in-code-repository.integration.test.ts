// The code guards must hold in the database itself, under concurrency, not
// just in the in-memory double. Run with `npm run test:integration`.

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaAccountRepository } from "./prisma-account-repository";
import { PrismaSignInCodeRepository } from "./prisma-sign-in-code-repository";

const prisma = new PrismaClient();
const codes = new PrismaSignInCodeRepository(prisma);
const accounts = new PrismaAccountRepository(prisma);
let accountId: string;

beforeEach(async () => {
  await prisma.signInCode.deleteMany();
  await prisma.itemAuditEntry.deleteMany();
  await prisma.item.deleteMany();
  await prisma.order.deleteMany();
  await prisma.account.deleteMany({ where: { role: "CUSTOMER" } });
  accountId = (await prisma.account.create({ data: { email: "codes@example.com", phone: "2125550142" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("PrismaSignInCodeRepository (integration)", () => {
  const expiresAt = new Date(Date.now() + 60_000);

  it("finds accounts case-insensitively by email", async () => {
    expect(await accounts.findByEmail("  CODES@Example.com ")).toMatchObject({ id: accountId, role: "CUSTOMER" });
    expect(await accounts.findByEmail("nobody@example.com")).toBeNull();
  });

  it("returns the latest code and counts recent ones", async () => {
    await codes.create({ accountId, codeHash: "aa", expiresAt });
    await codes.create({ accountId, codeHash: "bb", expiresAt });
    expect((await codes.findLatest(accountId))?.codeHash).toBe("bb");
    expect(await codes.countCreatedSince(accountId, new Date(Date.now() - 60_000))).toBe(2);
  });

  it("never records more than the maximum attempts, even for parallel guesses", async () => {
    await codes.create({ accountId, codeHash: "aa", expiresAt });
    const code = (await codes.findLatest(accountId))!;
    const results = await Promise.all(Array.from({ length: 10 }, () => codes.recordAttempt(code.id, 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect((await codes.findLatest(accountId))?.attempts).toBe(5);
  });

  it("consumes a code exactly once, even for parallel verifications", async () => {
    await codes.create({ accountId, codeHash: "aa", expiresAt });
    const code = (await codes.findLatest(accountId))!;
    const results = await Promise.all([codes.consume(code.id, new Date()), codes.consume(code.id, new Date())]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
