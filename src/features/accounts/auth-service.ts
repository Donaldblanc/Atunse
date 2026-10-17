import type { PrismaClient } from "@prisma/client";
import { hashPassword, MISSING_ACCOUNT_PASSWORD_HASH, passwordNeedsRehash, verifyPassword } from "./password";
import type { Role } from "./authz";

export interface AuthenticatedAccount {
  accountId: string;
  role: Role;
  /** The Account's current sessionVersion, for the session cookie to carry. */
  sessionVersion: number;
}

// Adapter boundary (ADR-0003): use-cases/routes depend on this interface,
// not on Prisma or the password scheme directly, so swapping to a managed
// auth provider (ADR-0005) later doesn't ripple into callers.
export interface AuthService {
  verifyCredentials(email: string, password: string): Promise<AuthenticatedAccount | null>;
}

export class PrismaPasswordAuthService implements AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async verifyCredentials(email: string, password: string): Promise<AuthenticatedAccount | null> {
    // Admin password login only (ADR-0005 addendum). A customer with the
    // same email is a separate Account and can't sign in here (ADR-0014).
    const account = await this.prisma.account.findUnique({
      where: { email_role: { email: email.trim().toLowerCase(), role: "ADMIN" } },
    });
    // Always run one scrypt check, even with no account to check against,
    // so response time doesn't reveal which emails are admins.
    const matches = await verifyPassword(password, account?.passwordHash ?? MISSING_ACCOUNT_PASSWORD_HASH);
    if (!account || !account.passwordHash || !matches) return null;

    // Upgrade an old-cost hash now that we hold the plaintext. Not a
    // password change: sessionVersion stays, so other sessions survive.
    if (passwordNeedsRehash(account.passwordHash)) {
      await this.prisma.account.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(password) } });
    }

    return { accountId: account.id, role: account.role, sessionVersion: account.sessionVersion };
  }
}
