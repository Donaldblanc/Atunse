import { prisma } from "@/shared/db/prisma-client";
import { PrismaAccountRepository } from "./repositories/prisma-account-repository";
import type { AccountRepository } from "./repositories/account-repository";

/**
 * Where an admin session cookie's sessionVersion is checked against the
 * Account's current one, which is what makes sign-out and password changes
 * revoke a stateless cookie. A seam so unit tests can hand in an in-memory
 * repository (or mock this module) instead of reaching a database.
 */
export type AdminSessionVersions = Pick<AccountRepository, "findAdminSessionVersion">;

export function defaultAdminSessionVersions(): AdminSessionVersions {
  return new PrismaAccountRepository(prisma);
}
