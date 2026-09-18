import type { PrismaClient } from "@prisma/client";
import { verifyPassword } from "./password";
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
    const account = await this.prisma.account.findUnique({ where: { email: email.toLowerCase() } });
    if (!account || !account.passwordHash) return null;
    if (!verifyPassword(password, account.passwordHash)) return null;

    return { accountId: account.id, role: account.role };
  }
}
