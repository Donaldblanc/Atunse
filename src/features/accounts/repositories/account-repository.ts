// Account lookups for the sign-in use-cases (ADR-0003/0011: use-cases
// depend on this interface, never on Prisma directly).

import type { Role } from "../authz";

export interface AccountRecord {
  id: string;
  role: Exclude<Role, "GUEST">;
  email: string;
}

export interface AccountRepository {
  /** `email` is matched case-insensitively (emails are stored lowercased). */
  findByEmail(email: string): Promise<AccountRecord | null>;
}
