import type { ActingUser } from "../authz";
import { requireRole, UnauthorizedError } from "../authz";
import { isValidEmail } from "@/features/orders/contact-rules";
import { hashPassword, verifyPassword } from "../password";
import { AdminEmailTakenError, type AccountRepository } from "../repositories/account-repository";

export class AdminNotFoundError extends Error {
  constructor() {
    super("Admin account not found");
    this.name = "AdminNotFoundError";
  }
}

export type ProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Settings' Account Settings "Save": the signed-in admin's own name and
 * email (ADR-0014: a separate identity from any Customer Account sharing
 * the email). `requireRole` alone isn't enough here — an admin may only
 * edit their own Account, never another admin's.
 */
export async function updateAdminProfile(
  deps: { accounts: AccountRepository },
  actingUser: ActingUser,
  input: { accountId: string; name: string; email: string },
): Promise<ProfileResult> {
  requireRole(actingUser, "ADMIN");
  if (actingUser.accountId !== input.accountId) throw new UnauthorizedError("An admin may only edit their own account.");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter your name." };
  if (!isValidEmail(email) || email.length > 254) return { ok: false, error: "Enter a valid email address." };

  const admin = await deps.accounts.findAdminById(input.accountId);
  if (!admin) throw new AdminNotFoundError();

  try {
    await deps.accounts.updateAdminProfile(input.accountId, { name, email });
  } catch (err) {
    if (err instanceof AdminEmailTakenError) return { ok: false, error: "Another admin uses that email." };
    throw err;
  }
  return { ok: true };
}

/**
 * Settings' Account Settings "Change Password" — this repo's interim
 * credential auth (ADR-0005 addendum), not a managed provider's reset flow.
 * Requires the current password so a stolen session alone can't lock the
 * real admin out.
 */
export async function changeAdminPassword(
  deps: { accounts: AccountRepository },
  actingUser: ActingUser,
  input: { accountId: string; currentPassword: string; newPassword: string },
): Promise<ProfileResult> {
  requireRole(actingUser, "ADMIN");
  if (actingUser.accountId !== input.accountId) throw new UnauthorizedError("An admin may only change their own password.");

  if (input.newPassword.length < 8) return { ok: false, error: "Use a password of at least 8 characters." };

  const admin = await deps.accounts.findAdminById(input.accountId);
  if (!admin) throw new AdminNotFoundError();
  if (!admin.passwordHash || !(await verifyPassword(input.currentPassword, admin.passwordHash))) {
    return { ok: false, error: "That current password isn't right." };
  }

  await deps.accounts.updateAdminPasswordHash(input.accountId, await hashPassword(input.newPassword));
  return { ok: true };
}
