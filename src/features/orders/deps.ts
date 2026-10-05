import { prisma } from "@/shared/db/prisma-client";
import { PrismaAccountRepository } from "@/features/accounts/repositories/prisma-account-repository";
import { notificationServiceFromEnv } from "@/features/notifications";
import { contactInboxFromEnv } from "@/features/contact/contact-message";
import { isCustomerSignInEnabled } from "@/shared/config/feature-flags";
import { getFileStorage } from "@/shared/storage";
import { paymentInstructionsFromEnv } from "./payment-instructions";
import { PrismaOrderRepository } from "./repositories/prisma-order-repository";

// Wires the real (Prisma-backed) implementations behind the use-case
// deps interface (ADR-0003/0011). API routes import this instead of
// constructing repositories/adapters themselves — the one place adapters
// (storage, notifications) are chosen.
export function buildOrderUseCaseDeps() {
  return {
    orders: new PrismaOrderRepository(prisma),
    accounts: new PrismaAccountRepository(prisma),
    notifications: notificationServiceFromEnv(),
    paymentInstructions: paymentInstructionsFromEnv(),
    customerSignInEnabled: isCustomerSignInEnabled(),
    /** The same inbox the contact form uses (CONTACT_EMAIL). */
    ownerInbox: contactInboxFromEnv(),
    /** Built on first use: it throws StorageNotConfiguredError when misconfigured. */
    get storage() {
      return getFileStorage();
    },
  };
}
