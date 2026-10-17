import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../authz";
import { hashPassword } from "../password";
import { InMemoryAccounts } from "../repositories/in-memory-repositories";
import { AdminNotFoundError, changeAdminPassword, PASSWORD_RATE_LIMITED_MESSAGE, updateAdminProfile } from "./update-admin-profile";

async function setup() {
  const accounts = new InMemoryAccounts();
  const passwordHash = await hashPassword("correct-horse-battery");
  const admin = accounts.add({ role: "ADMIN", email: "dj@atunse.com", name: "DJ", passwordHash });
  const other = accounts.add({ role: "ADMIN", email: "other@atunse.com", name: "Other" });
  return { accounts, admin, other };
}

describe("updateAdminProfile", () => {
  it("updates the signed-in admin's own name and email", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "DJ Blanc", email: "dj2@atunse.com", currentPassword: "correct-horse-battery" });
    expect(result).toEqual({ ok: true });
    const found = await accounts.findAdminById(admin.id);
    expect(found).toMatchObject({ name: "DJ Blanc", email: "dj2@atunse.com" });
  });

  it("shows a field error when another admin already uses the email", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "DJ", email: "Other@atunse.com", currentPassword: "correct-horse-battery" });
    expect(result).toEqual({ ok: false, error: "Another admin uses that email." });
    expect((await accounts.findAdminById(admin.id))?.email).toBe("dj@atunse.com");
  });

  it("changes only the name without the password, and keeps sessions", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "New Name", email: "DJ@atunse.com" });
    expect(result).toEqual({ ok: true });
    expect(await accounts.findAdminById(admin.id)).toMatchObject({ name: "New Name", sessionVersion: 0 });
  });

  it("refuses an email change without the right current password, and leaves the email alone", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    for (const currentPassword of [undefined, "", "wrong"]) {
      const result = await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "DJ", email: "new@atunse.com", currentPassword });
      expect(result).toEqual({ ok: false, error: "That current password isn't right." });
    }
    expect((await accounts.findAdminById(admin.id))?.email).toBe("dj@atunse.com");
  });

  it("bumps sessionVersion when the email changes", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "DJ", email: "new@atunse.com", currentPassword: "correct-horse-battery" });
    expect((await accounts.findAdminSessionVersion(admin.id))).toBe(1);
  });

  it("stops checking passwords once the attempt budget is spent", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const deps = { accounts, allowPasswordAttempt: async () => false };
    const result = await updateAdminProfile(deps, actingUser, { accountId: admin.id, name: "DJ", email: "new@atunse.com", currentPassword: "correct-horse-battery" });
    expect(result).toEqual({ ok: false, error: PASSWORD_RATE_LIMITED_MESSAGE });
    expect((await accounts.findAdminById(admin.id))?.email).toBe("dj@atunse.com");
  });

  it("does not spend an attempt on a name-only change", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    let attempts = 0;
    const deps = { accounts, allowPasswordAttempt: async () => (attempts += 1) > 0 };
    await updateAdminProfile(deps, actingUser, { accountId: admin.id, name: "Other Name", email: "dj@atunse.com" });
    expect(attempts).toBe(0);
  });

  it("refuses to edit another admin's account", async () => {
    const { accounts, admin, other } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    await expect(updateAdminProfile({ accounts }, actingUser, { accountId: other.id, name: "X", email: "x@example.com" })).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a blank name or invalid email", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    expect(await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "  ", email: "dj@atunse.com" })).toEqual({ ok: false, error: expect.any(String) });
    expect(await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "DJ", email: "not-an-email" })).toEqual({ ok: false, error: expect.any(String) });
  });

  it("throws AdminNotFoundError for a non-admin id", async () => {
    const { accounts } = await setup();
    const actingUser = { accountId: "ghost", role: "ADMIN" as const };
    await expect(updateAdminProfile({ accounts }, actingUser, { accountId: "ghost", name: "DJ", email: "dj@atunse.com" })).rejects.toThrow(AdminNotFoundError);
  });
});

describe("changeAdminPassword", () => {
  it("changes the password when the current one is right", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await changeAdminPassword({ accounts }, actingUser, { accountId: admin.id, currentPassword: "correct-horse-battery", newPassword: "a-new-password" });
    expect(result).toEqual({ ok: true });
    expect(await accounts.findAdminSessionVersion(admin.id)).toBe(1);
  });

  it("refuses while the attempt budget is spent, even with the right password", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await changeAdminPassword({ accounts, allowPasswordAttempt: async () => false }, actingUser, { accountId: admin.id, currentPassword: "correct-horse-battery", newPassword: "a-new-password" });
    expect(result).toEqual({ ok: false, error: PASSWORD_RATE_LIMITED_MESSAGE });
    expect(await accounts.findAdminSessionVersion(admin.id)).toBe(0);
  });

  it("rejects the wrong current password", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await changeAdminPassword({ accounts }, actingUser, { accountId: admin.id, currentPassword: "wrong", newPassword: "a-new-password" });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it("rejects a too-short new password", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await changeAdminPassword({ accounts }, actingUser, { accountId: admin.id, currentPassword: "correct-horse-battery", newPassword: "short" });
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });
});
