import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";

export const MAX_NOTIFICATION_IDS = 50;
const MAX_NOTIFICATION_ID_LENGTH = 64;

/** The ids to mark read aren't 1 to 50 non-empty strings of at most 64 characters. */
export class InvalidNotificationIdsError extends Error {
  constructor() {
    super("Pick between 1 and 50 notifications to mark read.");
    this.name = "InvalidNotificationIdsError";
  }
}

/**
 * Marks bell notifications read: the given ids, or all of them. Admin-only
 * (ADR-0012). Naturally idempotent (only unread rows change), so it takes no
 * idempotency key.
 */
export async function markNotificationsRead(
  deps: { orders: Pick<OrderRepository, "markAdminNotificationsRead"> },
  actingUser: ActingUser,
  input: { ids: string[] } | { all: true },
  now: () => Date = () => new Date(),
): Promise<void> {
  requireRole(actingUser, "ADMIN");
  if ("all" in input) return deps.orders.markAdminNotificationsRead("all", now());

  const { ids } = input;
  const valid =
    Array.isArray(ids) &&
    ids.length >= 1 &&
    ids.length <= MAX_NOTIFICATION_IDS &&
    ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_NOTIFICATION_ID_LENGTH);
  if (!valid) throw new InvalidNotificationIdsError();
  await deps.orders.markAdminNotificationsRead(ids, now());
}
