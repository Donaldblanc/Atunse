import type { NotificationService } from "@/features/notifications/notification-service";
import type { AccountRepository } from "../repositories/account-repository";
import type { SignInCodeRepository } from "../repositories/sign-in-code-repository";
import {
  CODE_REQUEST_WINDOW_MINUTES,
  generateSignInCode,
  hashSignInCode,
  MAX_CODES_PER_WINDOW,
  SIGN_IN_CODE_TTL_MINUTES,
} from "../sign-in-codes";

export interface SignInCodeDeps {
  accounts: AccountRepository;
  codes: SignInCodeRepository;
  notifications: NotificationService;
  /** Keys the code HMAC (SESSION_SECRET). */
  secret: string;
  now?: () => Date;
  generateCode?: () => string;
}

export class TooManyCodeRequestsError extends Error {
  constructor() {
    super(`Too many codes requested. Try again in ${CODE_REQUEST_WINDOW_MINUTES} minutes.`);
    this.name = "TooManyCodeRequestsError";
  }
}

/**
 * Emails a one-time sign-in code to a Customer Account (ADR-0014). Unknown
 * emails and Admin Accounts (who use the admin password login) get the same
 * silent success, so this can't be used to probe which emails are Customers.
 */
export async function requestSignInCode(deps: SignInCodeDeps, email: string): Promise<void> {
  const account = await deps.accounts.findByEmail(email);
  if (!account || account.role !== "CUSTOMER") return;

  const now = deps.now?.() ?? new Date();
  const windowStart = new Date(now.getTime() - CODE_REQUEST_WINDOW_MINUTES * 60_000);
  if ((await deps.codes.countCreatedSince(account.id, windowStart)) >= MAX_CODES_PER_WINDOW) {
    throw new TooManyCodeRequestsError();
  }

  const code = (deps.generateCode ?? generateSignInCode)();
  await deps.codes.create({
    accountId: account.id,
    codeHash: hashSignInCode(code, deps.secret),
    expiresAt: new Date(now.getTime() + SIGN_IN_CODE_TTL_MINUTES * 60_000),
  });

  await deps.notifications.sendEmail({
    to: account.email,
    subject: `${code} is your Atunṣe sign-in code`,
    body: [
      `Your sign-in code is ${code}.`,
      `It expires in ${SIGN_IN_CODE_TTL_MINUTES} minutes and works once.`,
      "If you didn't ask for it, you can ignore this email.",
    ].join("\n\n"),
  });
}
