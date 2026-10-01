import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import { redactForLog } from "@/shared/logging/redact";
import { Money } from "@/shared/money/money";
import { MAX_QUOTE_CENTS, MIN_QUOTE_CENTS } from "../domain";
import type { OrderRepository } from "../repositories/order-repository";
import { quoteSentEmail } from "../status-emails";

/** The audit action for the owner sending a pair's quote (ADR-0001, ADR-0012). */
export const QUOTE_SENT = "QUOTE_SENT";

export class InvalidQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQuoteError";
  }
}

export type SendQuoteResult = { status: "sent"; emailFailed: boolean } | { status: "already-sent" };

/**
 * The Approval Gate's quote step (ADR-0001): the owner's final price for one
 * pair. In ONE repository transaction it sets Item.priceCents and moves the
 * pair UNDER_REVIEW to QUOTE_SENT with a QUOTE_SENT audit entry (metadata:
 * the price and the estimate it replaces), then emails the customer the
 * price. Admin-only.
 *
 * Idempotent on `idempotencyKey` (ADR-0012): a replay writes nothing and
 * sends no second email ("already-sent"). A pair no longer Under Review
 * (a stale screen) is refused by the repository with ItemStatusChangedError.
 * An email failure doesn't undo the quote (it's recorded); the result says
 * so, so the owner can tell the customer by hand.
 */
export async function sendQuote(
  deps: { orders: OrderRepository; notifications: NotificationService },
  actingUser: ActingUser,
  input: { itemId: string; priceCents: number; idempotencyKey: string },
): Promise<SendQuoteResult> {
  requireRole(actingUser, "ADMIN");
  if (!input.idempotencyKey) throw new InvalidQuoteError("Reload and try again.");
  if (!Number.isInteger(input.priceCents) || input.priceCents < MIN_QUOTE_CENTS) throw new InvalidQuoteError(`Enter a price of ${Money.fromCents(MIN_QUOTE_CENTS).format()} or more.`);
  if (input.priceCents > MAX_QUOTE_CENTS) throw new InvalidQuoteError(`Enter a price of ${Money.fromCents(MAX_QUOTE_CENTS).format()} or less.`);

  const price = Money.fromCents(input.priceCents);
  const updated = await deps.orders.transitionItemStatus({
    itemId: input.itemId,
    toStatus: "QUOTE_SENT",
    price,
    entry: {
      action: QUOTE_SENT,
      fromStatus: "UNDER_REVIEW",
      toStatus: "QUOTE_SENT",
      actorAccountId: actingUser.accountId,
      idempotencyKey: input.idempotencyKey,
      metadata: { priceCents: price.cents },
    },
  });
  if (!updated) return { status: "already-sent" };

  try {
    const order = await deps.orders.findByItemId(input.itemId);
    const item = order?.items.find((candidate) => candidate.id === input.itemId);
    if (!order || !item) throw new Error("Order not found after quoting");
    await deps.notifications.sendEmail({ to: order.contactEmail, ...quoteSentEmail(order, item) });
  } catch (err) {
    console.error(`[orders] quote saved, but the customer email failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    return { status: "sent", emailFailed: true };
  }
  return { status: "sent", emailFailed: false };
}
