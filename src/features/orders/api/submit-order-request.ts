// Request/response shapes for POST /api/v1/orders. Lives here rather than
// in the route file because Next route modules may only export handlers,
// and this parsing is worth unit-testing on its own. Shape checks only:
// the domain rules (Pickup area, dates, Services, photos) are enforced by
// submitOrder so they hold for every caller, not just this route.

import { z } from "zod";
import { orderReference, type Order } from "../domain";
import type { PaymentInstructions } from "../payment-instructions";
import type { SubmitOrderInput } from "../use-cases/submit-order";

const text = (max: number) => z.string().max(max);
const optionalText = (max: number) => z.string().max(max).nullish().transform((v) => v ?? null);

const address = z.object({
  line1: text(200),
  line2: optionalText(200),
  city: text(100),
  state: text(2),
  zip: text(10),
});

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const submitOrderBody = z.object({
  policyAccepted: z.boolean(),
  contact: z.object({ name: text(120), email: text(254), phone: text(30) }),
  fulfillment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("PICKUP"), address, date: calendarDate, slot: text(40) }),
    z.object({ method: z.literal("MAIL_IN"), address, preferredDate: calendarDate.nullish().transform((v) => v ?? null) }),
  ]),
  rush: z.boolean(),
  item: z.object({
    brand: optionalText(200),
    material: optionalText(40),
    notes: optionalText(2000),
    serviceIds: z.array(text(40)).max(10),
    photoKeys: z.array(text(200)).max(10),
  }),
});

const submissionKey = z.string().uuid();

export type ParseResult = { ok: true; value: SubmitOrderInput } | { ok: false; error: string };

export function parseSubmitOrderRequest(body: unknown, idempotencyKey: string | null): ParseResult {
  const parsed = submitOrderBody.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, error: `${issue.path.join(".") || "body"}: ${issue.message}` };
  }
  if (idempotencyKey !== null && !submissionKey.safeParse(idempotencyKey).success) {
    return { ok: false, error: "Idempotency-Key header must be a UUID" };
  }
  return { ok: true, value: { ...parsed.data, submissionKey: idempotencyKey } };
}

/** What the booking confirmation needs: no internal ids beyond the order's own. */
export function toSubmitOrderResponse(order: Order, paymentInstructions: PaymentInstructions) {
  return {
    order: {
      id: order.id,
      reference: orderReference(order.id),
      fulfillmentMethod: order.fulfillment.method,
      estimateCents: order.estimate.cents,
      estimateIsMinimum: order.estimateIsMinimum,
      depositCents: order.deposit.cents,
    },
    paymentInstructions,
  };
}

export type SubmitOrderResponse = ReturnType<typeof toSubmitOrderResponse>;
