import { PrismaAccountRepository } from "@/features/accounts/repositories/prisma-account-repository";
import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import type { CustomerDetailDeps } from "./customer-detail";
import type { ListCustomersDeps } from "./list-customers";

// The real (Prisma-backed) implementations behind listCustomers and
// getCustomerDetail (ADR-0003/0011); the admin pages import this, never
// Prisma.
export function buildAdminCustomersDeps(): ListCustomersDeps & CustomerDetailDeps {
  return {
    accounts: new PrismaAccountRepository(prisma),
    orders: new PrismaOrderRepository(prisma),
  };
}
