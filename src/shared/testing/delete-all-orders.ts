import type { PrismaClient } from "@prisma/client";
import { isTestDatabaseName } from "./test-env";

/**
 * Integration tests' reset: deletes every Order and everything that hangs
 * off one or off a customer (messages, notes, reviews, notifications,
 * stock used on Orders), children first so no foreign key blocks it. The
 * catalog and settings (seeded by migration) and Accounts are left alone.
 * Refuses unless connected to a database named *_test (test-env.ts).
 */
export async function deleteAllOrders(prisma: PrismaClient): Promise<void> {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const name = row?.name ?? "";
  if (!isTestDatabaseName(name)) {
    throw new Error(`Refusing to delete every Order in "${name}": not a *_test database.`);
  }
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.reviewPhoto.deleteMany();
  await prisma.review.deleteMany();
  await prisma.note.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.stockMovement.deleteMany({ where: { orderId: { not: null } } });
  await prisma.appointment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.itemAuditEntry.deleteMany();
  await prisma.itemPhoto.deleteMany();
  await prisma.item.deleteMany();
  await prisma.order.deleteMany();
}
