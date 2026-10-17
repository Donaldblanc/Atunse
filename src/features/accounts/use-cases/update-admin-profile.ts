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

/** `sessionVersion` is the Account's version after the write (null if the Account vanished), for re-issuing the caller's cookie. */
export type ProfileResult = { ok: true; sessionVersion: number | null } | { ok: false; error: string };

/**
 * Counts one password check against the account's attempt budget; false
 * means the budget is spent. Optional so tests can omit it; the real deps
 * (features/settings/deps.ts) always provide it.
 */
export type PasswordAttemptLimiter = (accountId: string) => Promise<boolean>;

export const PASSWORD_RATE_LIMITED_MESSAGE = "Too many password attempts. Please wait a few minutes and try again.";

/**
 * Settings' Account Settings "Save": the signed-in admin's own name and
 * email (ADR-0014: a separate identity from any Customer Account sharing
 * the email). `requireRole` alone isn't enough here — an admin may only
 * edit their own Account, never another admin's. Changing the email (what
 * the sign-in uses) also needs the current password, so a stolen session
 * alone can't take over the account; a name-only change doesn't.
 */
export async function updateAdminProfile(
  deps: { accounts: AccountRepository; allowPasswordAttempt?: PasswordAttemptLimiter },
  actingUser: ActingUser,
  input: { accountId: string; name: string; email: string; currentPassword?: string },
): Promise<ProfileResult> {
  requireRole(actingUser, "ADMIN");
  if (actingUser.accountId !== input.accountId) throw new UnauthorizedError("An admin may only edit their own account.");

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter your name." };
  if (!isValidEmail(email) || email.length > 254) return { ok: false, error: "Enter a valid email address." };

  const admin = await deps.accounts.findAdminById(input.accountId);
  if (!admin) throw new AdminNotFoundError();

  if (email !== admin.email) {
    const refused = await refuseUnlessPasswordMatches(deps, admin, input.currentPassword ?? "");
    if (refused) return refused;
  }

  let sessionVersion: number | null;
  try {
    sessionVersion = await deps.accounts.updateAdminProfile(input.accountId, { name, email });
  } catch (err) {
    if (err instanceof AdminEmailTakenError) return { ok: false, error: "Another admin uses that email." };
    throw err;
  }
  return { ok: true, sessionVersion };
}

/**
 * Settings' Account Settings "Change Password" — this repo's interim
 * credential auth (ADR-0005 addendum), not a managed provider's reset flow.
 * Requires the current password so a stolen session alone can't lock the
 * real admin out.
 */
export async function changeAdminPassword(
  deps: { accounts: AccountRepository; allowPasswordAttempt?: PasswordAttemptLimiter },
  actingUser: ActingUser,
  input: { accountId: string; currentPassword: string; newPassword: string },
): Promise<ProfileResult> {
  requireRole(actingUser, "ADMIN");
  if (actingUser.accountId !== input.accountId) throw new UnauthorizedError("An admin may only change their own password.");

  if (input.newPassword.length < 8) return { ok: false, error: "Use a password of at least 8 characters." };

  const admin = await deps.accounts.findAdminById(input.accountId);
  if (!admin) throw new AdminNotFoundError();
  const refused = await refuseUnlessPasswordMatches(deps, admin, input.currentPassword);
  if (refused) return refused;

  const sessionVersion = await deps.accounts.updateAdminPasswordHash(input.accountId, await hashPassword(input.newPassword));
  return { ok: true, sessionVersion };
}

/** Null when the password is right; otherwise the refusal to return. Counts against the per-account attempt budget first. */
async function refuseUnlessPasswordMatches(
  deps: { allowPasswordAttempt?: PasswordAttemptLimiter },
  admin: { id: string; passwordHash: string | null },
  password: string,
): Promise<{ ok: false; error: string } | null> {
  if (deps.allowPasswordAttempt && !(await deps.allowPasswordAttempt(admin.id))) {
    return { ok: false, error: PASSWORD_RATE_LIMITED_MESSAGE };
  }
  if (!admin.passwordHash || !(await verifyPassword(password, admin.passwordHash))) {
    return { ok: false, error: "That current password isn't right." };
  }
  return null;
}
