import { notificationServiceFromEnv } from "@/features/notifications";
import { prisma } from "@/shared/db/prisma-client";
import { PrismaAccountRepository } from "./repositories/prisma-account-repository";
import { PrismaSignInCodeRepository } from "./repositories/prisma-sign-in-code-repository";
import type { SignInCodeDeps } from "./use-cases/request-sign-in-code";

export function buildSignInCodeDeps(): SignInCodeDeps {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set — required to hash sign-in codes");
  return {
    accounts: new PrismaAccountRepository(prisma),
    codes: new PrismaSignInCodeRepository(prisma),
    notifications: notificationServiceFromEnv(),
    secret,
  };
}
