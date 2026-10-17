import { PrismaPaymentRepository } from "@/features/payments/repositories/prisma-payment-repository";
import { prisma } from "@/shared/db/prisma-client";

/** The real (Prisma-backed) implementation behind the Payments screen (ADR-0003/0011). */
export function buildPaymentsDeps() {
  return { payments: new PrismaPaymentRepository(prisma) };
}
