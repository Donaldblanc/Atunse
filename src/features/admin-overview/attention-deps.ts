import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import type { AttentionPanelDeps } from "./attention-panels";

// The real (Prisma-backed) implementation behind the Needs Attention panels (ADR-0003/0011).
export function buildAttentionPanelDeps(): AttentionPanelDeps {
  return { orders: new PrismaOrderRepository(prisma) };
}
