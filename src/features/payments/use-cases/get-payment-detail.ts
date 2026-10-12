// The Payments screen's Payment Details side panel (/admin/payments?payment=…).

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { PaymentDetail, PaymentRepository } from "../repositories/payment-repository";

export async function getPaymentDetail(deps: { payments: PaymentRepository }, actingUser: ActingUser, paymentId: string): Promise<PaymentDetail | null> {
  requireRole(actingUser, "ADMIN");
  return deps.payments.getPaymentDetail(paymentId);
}
