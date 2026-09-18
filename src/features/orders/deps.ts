import { prisma } from "@/shared/db/prisma-client";
import { ConsoleNotificationService } from "@/features/notifications/notification-service";
import { PrismaOrderRepository } from "./repositories/prisma-order-repository";

// Wires the real (Prisma-backed) implementations behind the use-case
// deps interface (ADR-0003/0011). API routes import this instead of
// constructing repositories/adapters themselves — one place to swap
// ConsoleNotificationService for the Resend adapter (ADR-0006) later.
export function buildOrderUseCaseDeps() {
  return {
    orders: new PrismaOrderRepository(prisma),
    notifications: new ConsoleNotificationService(),
  };
}
