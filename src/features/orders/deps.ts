import { prisma } from "@/shared/db/prisma-client";
import { notificationServiceFromEnv } from "@/features/notifications";
import { isCustomerSignInEnabled } from "@/shared/config/feature-flags";
import { paymentInstructionsFromEnv } from "./payment-instructions";
import { PrismaOrderRepository } from "./repositories/prisma-order-repository";

// Wires the real (Prisma-backed) implementations behind the use-case
// deps interface (ADR-0003/0011). API routes import this instead of
// constructing repositories/adapters themselves — one place to swap
// notification adapters (ADR-0006).
export function buildOrderUseCaseDeps() {
  return {
    orders: new PrismaOrderRepository(prisma),
    notifications: notificationServiceFromEnv(),
    paymentInstructions: paymentInstructionsFromEnv(),
    customerSignInEnabled: isCustomerSignInEnabled(),
  };
}
