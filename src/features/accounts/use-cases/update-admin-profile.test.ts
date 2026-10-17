import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "../authz";
import { hashPassword } from "../password";
import { InMemoryAccounts } from "../repositories/in-memory-repositories";
import { AdminNotFoundError, changeAdminPassword, updateAdminProfile } from "./update-admin-profile";

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
    const result = await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "DJ Blanc", email: "dj2@atunse.com" });
    expect(result).toEqual({ ok: true });
    const found = await accounts.findAdminById(admin.id);
    expect(found).toMatchObject({ name: "DJ Blanc", email: "dj2@atunse.com" });
  });

  it("shows a field error when another admin already uses the email", async () => {
    const { accounts, admin } = await setup();
    const actingUser = { accountId: admin.id, role: "ADMIN" as const };
    const result = await updateAdminProfile({ accounts }, actingUser, { accountId: admin.id, name: "DJ", email: "Other@atunse.com" });
    expect(result).toEqual({ ok: false, error: "Another admin uses that email." });
    expect((await accounts.findAdminById(admin.id))?.email).toBe("dj@atunse.com");
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
