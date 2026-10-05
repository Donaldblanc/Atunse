import { notificationServiceFromEnv } from "@/features/notifications";
import { prisma } from "@/shared/db/prisma-client";
import { PrismaMessageRepository } from "./repositories/prisma-message-repository";

// The real (Prisma-backed) implementations behind the Messages use-cases
// (ADR-0003/0011); actions and pages import this, never Prisma.
export function buildMessageDeps() {
  return { messages: new PrismaMessageRepository(prisma), notifications: notificationServiceFromEnv(), now: () => new Date() };
}
