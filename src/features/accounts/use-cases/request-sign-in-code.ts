import type { NotificationService } from "@/features/notifications/notification-service";
import type { AccountRepository } from "../repositories/account-repository";
import { SIGN_IN_CODE_TTL_MINUTES, type SignInCodes } from "../sign-in-codes";

export interface SignInCodeDeps {
  accounts: AccountRepository;
  codes: SignInCodes;
  notifications: NotificationService;
  now?: () => Date;
}

/**
 * Emails a one-time sign-in code to a Customer Account (ADR-0014). Always
 * looks the same to the caller: an unknown email, an Admin-only email, and
 * a rate-limited account all return silently without sending. Otherwise
 * how often it answered differently would reveal which emails are
 * customers.
 */
export async function requestSignInCode(deps: SignInCodeDeps, email: string): Promise<void> {
  const account = await deps.accounts.findCustomerByEmail(email);
  if (!account) return;

  const issued = await deps.codes.issue(account.id, deps.now?.() ?? new Date());
  if ("rateLimited" in issued) return;

  await deps.notifications.sendEmail({
    to: account.email,
    subject: `${issued.code} is your Atunṣe sign-in code`,
    body: [
      `Your sign-in code is ${issued.code}.`,
      `It expires in ${SIGN_IN_CODE_TTL_MINUTES} minutes and works once.`,
      "If you didn't ask for it, you can ignore this email.",
    ].join("\n\n"),
  });
}
