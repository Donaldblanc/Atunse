import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import { getFileStorage, type FileStorage } from "@/shared/storage";
import { photoUrlOrNull } from "@/features/admin-overview/deps";
import type { OrderDetailDeps } from "@/features/admin-overview/order-detail";
import { PrismaAccountRepository } from "@/features/accounts/repositories/prisma-account-repository";
import type { CustomerDetailDeps } from "@/features/admin-customers/customer-detail";
import { buildMessageDeps } from "@/features/messages/deps";

// The real (Prisma-backed) implementations behind the Messages screen's page
// (ADR-0003/0011): Conversations, the open thread's Order and Customer.
export function buildAdminMessagesDeps(): ReturnType<typeof buildMessageDeps> & OrderDetailDeps & CustomerDetailDeps {
  let storage: FileStorage | undefined;
  return {
    ...buildMessageDeps(),
    orders: new PrismaOrderRepository(prisma),
    accounts: new PrismaAccountRepository(prisma),
    photoUrl: async (key) => photoUrlOrNull(() => (storage ??= getFileStorage()), key),
  };
}
