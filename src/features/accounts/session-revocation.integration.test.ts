// Admin session revocation and password rehash against the real database.
// Run with `npm run test:integration` (against a throwaway database).

import { randomBytes, scryptSync } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { POST as signOut } from "@/app/api/v1/auth/sign-out/route";
import { prisma } from "@/shared/db/prisma-client";
import { checkAdminAccess } from "./admin-check";
import { hashPassword } from "./password";
import { PrismaAccountRepository } from "./repositories/prisma-account-repository";
import { SESSION_COOKIE_NAME } from "./session";
import { changeAdminPassword, updateAdminProfile } from "./use-cases/update-admin-profile";

const EMAIL = "revocation-it@example.com";
const PASSWORD = "correct horse battery staple";
const accounts = new PrismaAccountRepository(prisma);
let accountId: string;
let ipCounter = 0;

async function signInCookie(password = PASSWORD): Promise<string> {
  const res = await signIn(
    new NextRequest("http://localhost/api/v1/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ipCounter % 250}` },
      body: JSON.stringify({ email: EMAIL, password }),
    }),
  );
  expect(res.status).toBe(200);
  const header = res.headers.get("set-cookie") ?? "";
  return header.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))![1]!;
}

const allowed = async (cookie: string) =>
  (
    await checkAdminAccess(
      new NextRequest("http://localhost/admin", { headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } }),
    )
  ).allowed;

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-0123456789abcdef0123456789abcdef0123456789abcdef";
});

beforeEach(async () => {
  await prisma.rateLimitBucket.deleteMany();
  await prisma.account.deleteMany({ where: { role: "ADMIN", email: { in: [EMAIL, "revocation-it-2@example.com"] } } });
  const created = await prisma.account.create({ data: { email: EMAIL, role: "ADMIN", passwordHash: await hashPassword(PASSWORD) } });
  accountId = created.id;
});

afterAll(async () => {
  await prisma.rateLimitBucket.deleteMany();
  await prisma.account.deleteMany({ where: { role: "ADMIN", email: { in: [EMAIL, "revocation-it-2@example.com"] } } });
  await prisma.$disconnect();
});

describe("admin session revocation (integration)", () => {
  it("accepts a fresh session cookie", async () => {
    expect(await allowed(await signInCookie())).toBe(true);
  });

  it("sign-out invalidates the cookie itself, not just the browser's copy", async () => {
    const cookie = await signInCookie();
    await signOut(
      new NextRequest("http://localhost/api/v1/auth/sign-out", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } }),
    );
    expect(await allowed(cookie)).toBe(false);
    expect(await allowed(await signInCookie())).toBe(true); // signing in again works
  });

  it("sign-out with an already-revoked cookie does not bump the version again", async () => {
    const stolen = await signInCookie();
    const signOutWith = (cookie: string) =>
      signOut(new NextRequest("http://localhost/api/v1/auth/sign-out", { method: "POST", headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } }));
    await signOutWith(stolen); // the real admin signs out: revokes it
    const fresh = await signInCookie();
    const before = await accounts.findAdminSessionVersion(accountId);
    await signOutWith(stolen); // replayed revoked cookie
    expect(await accounts.findAdminSessionVersion(accountId)).toBe(before);
    expect(await allowed(fresh)).toBe(true);
  });

  it("a password change invalidates an old cookie", async () => {
    const cookie = await signInCookie();
    const result = await changeAdminPassword({ accounts }, { accountId, role: "ADMIN" }, { accountId, currentPassword: PASSWORD, newPassword: "a-brand-new-password" });
    expect(result).toMatchObject({ ok: true, sessionVersion: expect.any(Number) });
    expect(await allowed(cookie)).toBe(false);
  });

  it("an email change invalidates an old cookie, but a name-only change does not", async () => {
    const cookie = await signInCookie();
    const actingUser = { accountId, role: "ADMIN" as const };
    await updateAdminProfile({ accounts }, actingUser, { accountId, name: "Renamed", email: EMAIL });
    expect(await allowed(cookie)).toBe(true);
    const result = await updateAdminProfile({ accounts }, actingUser, { accountId, name: "Renamed", email: "revocation-it-2@example.com", currentPassword: PASSWORD });
    expect(result).toMatchObject({ ok: true, sessionVersion: expect.any(Number) });
    expect(await allowed(cookie)).toBe(false);
  });

  it("an email change without the current password changes nothing", async () => {
    const result = await updateAdminProfile({ accounts }, { accountId, role: "ADMIN" }, { accountId, name: "X", email: "revocation-it-2@example.com", currentPassword: "wrong" });
    expect(result.ok).toBe(false);
    expect((await accounts.findAdminById(accountId))?.email).toBe(EMAIL);
  });

  it("a cookie for a deleted account is refused", async () => {
    const cookie = await signInCookie();
    await prisma.account.delete({ where: { id: accountId } });
    expect(await allowed(cookie)).toBe(false);
  });
});

describe("password rehash on admin sign-in (integration)", () => {
  it("upgrades a legacy salt:hash to the current format, keeping other sessions alive", async () => {
    const salt = randomBytes(16);
    const legacy = `${salt.toString("hex")}:${scryptSync(PASSWORD, salt, 64).toString("hex")}`;
    await prisma.account.update({ where: { id: accountId }, data: { passwordHash: legacy } });
    const other = await signInCookie(); // verifies against the legacy hash, then rehashes
    const stored = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    expect(stored.passwordHash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(stored.sessionVersion).toBe(0);
    expect(await allowed(other)).toBe(true);
    expect(await signInCookie()).toBeTruthy(); // the new hash still verifies
  });
});
