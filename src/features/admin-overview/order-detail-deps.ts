import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { loadCatalog } from "@/features/services/site-catalog";
import { prisma } from "@/shared/db/prisma-client";
import { getFileStorage, type FileStorage } from "@/shared/storage";
import { photoUrlOrNull } from "./deps";
import type { OrderDetailDeps } from "./order-detail";

/** The real (Prisma-backed) implementations behind getOrderDetail (ADR-0003/0011). */
export function buildOrderDetailDeps(): OrderDetailDeps {
  let storage: FileStorage | undefined;
  return {
    orders: new PrismaOrderRepository(prisma),
    catalog: { load: loadCatalog },
    photoUrl: async (key) => photoUrlOrNull(() => (storage ??= getFileStorage()), key),
  };
}
