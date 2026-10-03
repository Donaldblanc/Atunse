import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import { redactForLog } from "@/shared/logging/redact";
import { canTransition, livePairs } from "../domain";
import { cancelledEmail } from "../status-emails";
import { OrderNotFoundError, type OrderRepository } from "../repositories/order-repository";
import { transitionItemStatus } from "./transition-item-status";

/** Every live pair is already Completed, so there's nothing left to cancel. */
export class OrderNotCancellableError extends Error {
  constructor() {
    super("This order is already completed, so it can't be cancelled.");
    this.name = "OrderNotCancellableError";
  }
}

/**
 * Cancels an Order from the Overview's Recent Orders menu: each live pair
 * goes to Cancelled through transitionItemStatus (so each is audited, and
 * the customer is told as for any cancelled pair). Admin-only (ADR-0012).
 *
 * Idempotent: each pair's audit key is derived from `idempotencyKey`, and a
 * pair already cancelled is skipped, so a replay or a double click changes
 * nothing and reports "already-cancelled".
 */
export async function cancelOrder(
  deps: { orders: OrderRepository; notifications: NotificationService },
  actingUser: ActingUser,
  input: { orderId: string; idempotencyKey: string },
): Promise<"cancelled" | "already-cancelled"> {
  requireRole(actingUser, "ADMIN");

  const order = await deps.orders.findById(input.orderId);
  if (!order) throw new OrderNotFoundError(input.orderId);
  const live = livePairs(order);
  if (live.length === 0) return "already-cancelled";
  const cancellable = live.filter((item) => canTransition(item.status, "CANCELLED"));
  if (cancellable.length === 0) throw new OrderNotCancellableError();

  let changed = false;
  for (const item of cancellable) {
    const moved = await transitionItemStatus(deps, actingUser, {
      itemId: item.id,
      fromStatus: item.status,
      toStatus: "CANCELLED",
      action: "STATUS_TRANSITION",
      idempotencyKey: `${input.idempotencyKey}:${item.id}`,
      notifyCustomer: false, // one summary below, not one email per pair
    });
    if (moved) changed = true;
  }
  if (changed) await emailCustomer(deps, input.orderId, cancellable[cancellable.length - 1]!.id);
  return "cancelled";
}

/** One email for the whole cancellation, after the writes. A failed send is logged, not thrown: the cancel already happened. */
async function emailCustomer(deps: { orders: OrderRepository; notifications: NotificationService }, orderId: string, lastItemId: string): Promise<void> {
  try {
    const order = await deps.orders.findById(orderId);
    const item = order?.items.find((candidate) => candidate.id === lastItemId);
    if (order && item) await deps.notifications.sendEmail({ to: order.contactEmail, ...cancelledEmail(order, item) });
  } catch (err) {
    console.error(`[orders] order cancelled, but the customer email failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
  }
}
