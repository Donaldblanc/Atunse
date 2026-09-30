import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import { getFileStorage } from "@/shared/storage";
import type { AdminOverviewDeps } from "./get-admin-overview";

// The real (Prisma-backed) implementations behind getAdminOverview
// (ADR-0003/0011); the admin page imports this, never Prisma.
export function buildAdminOverviewDeps(): AdminOverviewDeps {
  return {
    orders: new PrismaOrderRepository(prisma),
    // Photos are a nicety here: with storage unconfigured (StorageNotConfiguredError)
    // or failing, the table shows a placeholder instead of failing the page.
    photoUrl: async (key) => {
      try {
        return await getFileStorage().createViewUrl(key);
      } catch {
        return null;
      }
    },
    now: () => new Date(),
  };
}
