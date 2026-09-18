// ADR-0012: authorization is checked inside the use-case, never trusted
// just because a route middleware let the request through.

export type Role = "CUSTOMER" | "ADMIN" | "GUEST";

export interface ActingUser {
  accountId: string | null; // null for a guest
  role: Role;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function requireRole(user: ActingUser, ...allowed: Role[]): void {
  if (!allowed.includes(user.role)) {
    throw new UnauthorizedError(
      `Role ${user.role} is not permitted; requires one of: ${allowed.join(", ")}`,
    );
  }
}
