import type { PrismaClient } from "@prisma/client";

/**
 * Integration tests' reset: deletes every Order and everything that hangs
 * off one, children first so no foreign key blocks it. The services and
 * bundles catalog (seeded by migration) and Accounts are left alone.
 */
export async function deleteAllOrders(prisma: PrismaClient): Promise<void> {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.itemAuditEntry.deleteMany();
  await prisma.itemPhoto.deleteMany();
  await prisma.item.deleteMany();
  await prisma.order.deleteMany();
}
