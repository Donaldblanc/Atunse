import { emailDeliveryConfigured, notificationServiceFromEnv } from "@/features/notifications";
import { derivedSecret, WeakSecretError } from "@/shared/crypto/derived-key";
import { prisma } from "@/shared/db/prisma-client";
import { PrismaAccountRepository } from "./repositories/prisma-account-repository";
import { PrismaSignInCodes } from "./repositories/prisma-sign-in-codes";
import type { SignInCodeDeps } from "./use-cases/request-sign-in-code";

/** Customer sign-in can't work safely right now; the routes answer 503. */
export class SignInUnavailableError extends Error {}

export function buildSignInCodeDeps(env: NodeJS.ProcessEnv = process.env): SignInCodeDeps {
  let secret: string;
  try {
    secret = derivedSecret("sign-in-code", env);
  } catch (err) {
    if (err instanceof WeakSecretError) throw new SignInUnavailableError(err.message);
    throw err;
  }
  // Fail closed: in production, codes must go out by email, never to the
  // console, whose output lands in the hosting logs (ADR-0014).
  if (env.NODE_ENV === "production" && !emailDeliveryConfigured(env)) {
    throw new SignInUnavailableError("RESEND_API_KEY and EMAIL_FROM must be set for customer sign-in in production");
  }
  return {
    accounts: new PrismaAccountRepository(prisma),
    codes: new PrismaSignInCodes(prisma, secret),
    notifications: notificationServiceFromEnv(env),
  };
}
