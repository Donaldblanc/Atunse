import type { PrismaClient } from "@prisma/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "./password";

const verifyCalls: string[] = [];
vi.mock("./password", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./password")>();
  return {
    ...actual,
    verifyPassword: vi.fn(async (password: string, hash: string) => {
      verifyCalls.push(hash);
      return actual.verifyPassword(password, hash);
    }),
  };
});

const { PrismaPasswordAuthService } = await import("./auth-service");

let adminHash: string;
beforeAll(async () => {
  adminHash = await hashPassword("s3cret-admin");
});

function serviceWith(account: { id: string; role: "ADMIN"; passwordHash: string | null } | null) {
  const prisma = { account: { findUnique: async () => account } } as unknown as PrismaClient;
  return new PrismaPasswordAuthService(prisma);
}

describe("PrismaPasswordAuthService", () => {
  it("signs in an admin with the right password only", async () => {
    const service = serviceWith({ id: "acc_admin", role: "ADMIN", passwordHash: adminHash });
    expect(await service.verifyCredentials("owner@example.com", "s3cret-admin")).toEqual({ accountId: "acc_admin", role: "ADMIN" });
    expect(await service.verifyCredentials("owner@example.com", "wrong")).toBeNull();
  });

  it("still runs a full password check for an unknown email, so timing can't reveal admins", async () => {
    verifyCalls.length = 0;
    expect(await serviceWith(null).verifyCredentials("nobody@example.com", "guess")).toBeNull();
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it("does the same for an account without a password", async () => {
    verifyCalls.length = 0;
    expect(await serviceWith({ id: "acc", role: "ADMIN", passwordHash: null }).verifyCredentials("a@b.co", "guess")).toBeNull();
    expect(verifyCalls).toHaveLength(1);
  });
});
