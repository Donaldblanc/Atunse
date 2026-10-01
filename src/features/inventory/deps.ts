import { prisma } from "@/shared/db/prisma-client";
import type { InventoryRepository } from "./repositories/inventory-repository";
import { PrismaInventoryRepository } from "./repositories/prisma-inventory-repository";

export interface InventoryDeps {
  inventory: InventoryRepository;
}

// The real (Prisma-backed) implementation (ADR-0003/0011); pages and actions import this, never Prisma.
export function buildInventoryDeps(): InventoryDeps {
  return { inventory: new PrismaInventoryRepository(prisma) };
}
