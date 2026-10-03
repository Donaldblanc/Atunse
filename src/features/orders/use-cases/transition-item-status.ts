import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import { adminStatusMoves, canTransition, ITEM_STATUS_LABELS, MANUAL_PAYMENT_CONFIRMED, type Item, type ItemStatus } from "../domain";
import { CompletionHeldError, ItemNotFoundError, type OrderRepository } from "../repositories/order-repository";
import { redactForLog } from "@/shared/logging/redact";
import { EMAILED_STATUSES, statusChangeEmail } from "../status-emails";

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
  /** Email the customer at the moments that matter (default true). False only for a caller that sends its own summary, like cancelOrder. */
  notifyCustomer?: boolean;
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
  const receivesDeposit = input.action === MANUAL_PAYMENT_CONFIRMED;
  if (current.status === input.fromStatus) {
    // Confirming the payment settles the Deposit in the same write, so it can't be what holds the move (ADR-0002).
    const payments = receivesDeposit ? before.payments.map((payment) => (payment.kind === "DEPOSIT" ? { ...payment, status: "RECEIVED" as const } : payment)) : before.payments;
    const { moves, held } = adminStatusMoves(current, { ...before, payments });
    if (!moves.includes(input.toStatus)) throw new MoveNotAllowedError(input.fromStatus, input.toStatus, held);
  }

  let updated: Item | null;
  try {
    updated = await deps.orders.transitionItemStatus({
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
      receivesDeposit,
      // The hold is checked again on the locked Order, in case a payment or pair changed since it was read here.
      enforceCompletionHold: true,
    });
  } catch (err) {
    if (err instanceof CompletionHeldError) throw new MoveNotAllowedError(input.fromStatus, input.toStatus, err.reason);
    throw err;
  }

  // updated === null means this idempotency key was already applied
  // (ADR-0012: retry-safe) — treat as success, but don't re-notify.
  // Only the moves that email re-read the Order (for the email's figures, after the write).
  if (updated && input.notifyCustomer !== false && EMAILED_STATUSES.includes(updated.status)) await emailCustomer(deps, input.itemId);
  return updated;
}

async function emailCustomer(deps: { orders: OrderRepository; notifications: NotificationService }, itemId: string): Promise<void> {
  try {
    const order = await deps.orders.findByItemId(itemId);
    const item = order?.items.find((candidate) => candidate.id === itemId);
    const email = order && item ? statusChangeEmail(order, item) : null;
    if (order && email) await deps.notifications.sendEmail({ to: order.contactEmail, ...email });
  } catch (err) {
    console.error(`[orders] status change saved, but the customer email failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
  }
}
