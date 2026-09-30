import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import { adminStatusMoves, canTransition, ITEM_STATUS_LABELS, MANUAL_PAYMENT_CONFIRMED, type Item, type ItemStatus } from "../domain";
import { ItemNotFoundError, type OrderRepository } from "../repositories/order-repository";
import { statusChangeEmail } from "../status-emails";

export class InvalidTransitionError extends Error {
  constructor(from: ItemStatus, to: ItemStatus) {
    super(`Cannot transition Item from ${from} to ${to}`);
  }
}

/** The step is a valid pipeline move but not a plain status change (it has its own step, or is held). */
export class MoveNotAllowedError extends Error {
  constructor(from: ItemStatus, to: ItemStatus, held: string | null) {
    super(held ?? `A pair can't move from ${ITEM_STATUS_LABELS[from]} to ${ITEM_STATUS_LABELS[to]} this way.`);
    this.name = "MoveNotAllowedError";
  }
}

export interface TransitionItemStatusInput {
  itemId: string;
  fromStatus: ItemStatus; // caller-supplied expected current state, guards races
  toStatus: ItemStatus;
  action: string; // e.g. "STATUS_TRANSITION", "MANUAL_PAYMENT_CONFIRMED"
  /** Required for actions with a real-world side effect the customer
   * could trigger twice (e.g. confirming a Zelle payment) — ADR-0012. */
  idempotencyKey?: string;
}

/**
 * The plain admin "Update Status": one pair to the pipeline's next step or
 * Cancelled, admin-only (ADR-0005, ADR-0001). It applies adminStatusMoves
 * itself, so the Order detail form and the admin API route can't force what
 * the screen holds back: Quote Sent and Approved (their own steps: sendQuote,
 * recordApproval) and anything past Approved while the Deposit is pending
 * (ADR-0002).
 *
 * The customer is emailed only at the moments that matter to them (status-
 * emails.ts: Ready for Drop-Off/Shipping, Cancelled), after the write
 * succeeds. An email that fails is logged, not thrown: the status change
 * already happened and the owner shouldn't retry it.
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

  const before = await deps.orders.findByItemId(input.itemId);
  const current = before?.items.find((item) => item.id === input.itemId);
  if (!before || !current) throw new ItemNotFoundError(input.itemId);
  // A stale fromStatus is left to the repository (ItemStatusChangedError); only judge the move the caller actually saw.
  if (current.status === input.fromStatus) {
    const { moves, held } = adminStatusMoves(current, before);
    if (!moves.includes(input.toStatus)) throw new MoveNotAllowedError(input.fromStatus, input.toStatus, held);
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
    // Confirming a Zelle/Cash payment settles the Order's Deposit Payment too (ADR-0002).
    receivesDeposit: input.action === MANUAL_PAYMENT_CONFIRMED,
  });

  // updated === null means this idempotency key was already applied
  // (ADR-0012: retry-safe) — treat as success, but don't re-notify.
  if (updated) await emailCustomer(deps, input.itemId);
  return updated;
}

async function emailCustomer(deps: { orders: OrderRepository; notifications: NotificationService }, itemId: string): Promise<void> {
  try {
    const order = await deps.orders.findByItemId(itemId);
    const item = order?.items.find((candidate) => candidate.id === itemId);
    const email = order && item ? statusChangeEmail(order, item) : null;
    if (order && email) await deps.notifications.sendEmail({ to: order.contactEmail, ...email });
  } catch (err) {
    console.error("[orders] status change saved, but the customer email failed", err);
  }
}
