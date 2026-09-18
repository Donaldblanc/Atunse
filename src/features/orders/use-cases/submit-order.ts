import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { NotificationService } from "@/features/notifications/notification-service";
import type { Order } from "../domain";
import type { OrderRepository } from "../repositories/order-repository";

export interface SubmitOrderInput {
  guestEmail: string;
  guestPhone: string | null;
  policyAccepted: boolean; // captured at submission itself, not deferred
  item: {
    brand: string | null;
    model: string | null;
    description: string | null;
    photoKeys: string[]; // from presigned S3 uploads (ADR-0004) — never raw file bytes
  };
}

export class PolicyNotAcceptedError extends Error {
  constructor() {
    super("Order cannot be submitted without accepting the required policies.");
  }
}

/**
 * Phase 1 vertical slice, step 1: guest (or account holder) submits an
 * Order with one Item. Every ADR-0012 concern is present: authz (anyone
 * can submit, but the check is still explicit), an audit-worthy business
 * rule (policy acceptance is mandatory, not just a UI checkbox), and a
 * notification on the resulting state.
 */
export async function submitOrder(
  deps: { orders: OrderRepository; notifications: NotificationService },
  actingUser: ActingUser,
  input: SubmitOrderInput,
): Promise<Order> {
  requireRole(actingUser, "GUEST", "CUSTOMER");

  if (!input.policyAccepted) {
    throw new PolicyNotAcceptedError();
  }

  const order = await deps.orders.create({
    accountId: actingUser.accountId,
    guestEmail: input.guestEmail,
    guestPhone: input.guestPhone,
    policyAcceptedAt: new Date(),
    item: input.item,
  });

  await deps.notifications.sendEmail({
    to: input.guestEmail,
    subject: "We received your order",
    body: `Order ${order.id} was submitted and is now under review.`,
  });

  return order;
}
