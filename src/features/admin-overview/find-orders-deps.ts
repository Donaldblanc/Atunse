import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { PrismaOrderSearchRepository } from "@/features/orders/repositories/prisma-order-search-repository";
import { prisma } from "@/shared/db/prisma-client";

/** The real implementations behind the All orders and Upcoming visits dialogs (ADR-0003/0011). */
export function buildFindOrdersDeps() {
  return {
    orderSearch: new PrismaOrderSearchRepository(prisma),
    orders: new PrismaOrderRepository(prisma),
  };
}
