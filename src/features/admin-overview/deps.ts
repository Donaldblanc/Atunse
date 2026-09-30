import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import type { AdminOverviewDeps } from "./get-admin-overview";

// The real (Prisma-backed) implementations behind getAdminOverview
// (ADR-0003/0011); the admin page imports this, never Prisma.
export function buildAdminOverviewDeps(): AdminOverviewDeps {
  return { orders: new PrismaOrderRepository(prisma), now: () => new Date() };
}
