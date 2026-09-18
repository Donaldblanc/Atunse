import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import { canTransition, type Item, type ItemStatus } from "../domain";
import type { OrderRepository } from "../repositories/order-repository";

export class InvalidTransitionError extends Error {
  constructor(from: ItemStatus, to: ItemStatus) {
    super(`Cannot transition Item from ${from} to ${to}`);
  }
}

export interface TransitionItemStatusInput {
  itemId: string;
  fromStatus: ItemStatus; // caller-supplied expected current state, guards races
  toStatus: ItemStatus;
  action: string; // e.g. "QUOTE_SENT", "MANUAL_PAYMENT_CONFIRMED", "APPROVED"
  /** Required for actions with a real-world side effect the customer
   * could trigger twice (e.g. confirming a Zelle payment) — ADR-0012. */
  idempotencyKey?: string;
  notifyEmail?: string;
  notifySubject?: string;
}

/**
 * Phase 1 vertical slice, step 2+: every subsequent step in the one real
 * workflow (owner reviews -> quotes -> customer's deposit confirmed ->
 * pipeline advances to Completed) goes through this single, generalized
 * use-case rather than one bespoke use-case per status. All of them are
 * admin-only for now (ADR-0005: every Item requires owner action, ADR-0001).
 */
export async function transitionItemStatus(
  deps: { orders: OrderRepository; notifications: NotificationService },
  actingUser: ActingUser,
  input: TransitionItemStatusInput,
): Promise<Item | null> {
  requireRole(actingUser, "ADMIN");

  if (!canTransition(input.fromStatus, input.toStatus)) {
    throw new InvalidTransitionError(input.fromStatus, input.toStatus);
  }

  const updated = await deps.orders.transitionItemStatus({
    itemId: input.itemId,
    toStatus: input.toStatus,
    entry: {
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorAccountId: actingUser.accountId,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  // updated === null means this idempotency key was already applied
  // (ADR-0012: retry-safe) — treat as success, but don't re-notify.
  if (updated && input.notifyEmail) {
    await deps.notifications.sendEmail({
      to: input.notifyEmail,
      subject: input.notifySubject ?? "Your order status changed",
      body: `Item ${updated.id} moved to ${updated.status}.`,
    });
  }

  return updated;
}
