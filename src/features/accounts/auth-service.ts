import type { PrismaClient } from "@prisma/client";
import { passwordHashForMissingAccount, verifyPassword } from "./password";
import type { Role } from "./authz";

export interface AuthenticatedAccount {
  accountId: string;
  role: Role;
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
    const matches = await verifyPassword(password, account?.passwordHash ?? (await passwordHashForMissingAccount()));
    if (!account || !account.passwordHash || !matches) return null;

    return { accountId: account.id, role: account.role };
  }
}
