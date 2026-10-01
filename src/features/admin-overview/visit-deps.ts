import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import { buildAdminOverviewDeps } from "./deps";
import type { ScheduledVisitDeps } from "./scheduled-visit";

/** The real implementations behind the Schedule Item dialog and its "Mark as Completed" (ADR-0003/0011). */
export function buildVisitDeps(): ScheduledVisitDeps & { orders: PrismaOrderRepository } {
  return { orders: new PrismaOrderRepository(prisma), photoUrl: buildAdminOverviewDeps().photoUrl };
}
