import type { PrismaClient } from "@prisma/client";

/**
 * Integration tests' reset: deletes every Order and everything that hangs
 * off one or off a customer (messages, notes, reviews, notifications,
 * stock used on Orders), children first so no foreign key blocks it. The
 * catalog and settings (seeded by migration) and Accounts are left alone.
 */
export async function deleteAllOrders(prisma: PrismaClient): Promise<void> {
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
