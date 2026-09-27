// Test doubles for the accounts module. InMemoryAccounts is the one
// in-memory accounts table: InMemoryOrderRepository creates new Customer
// Accounts in it too, so a unit test can go book → sign in → rebook.

import type { Role } from "../authz";
import {
  CODE_REQUEST_WINDOW_MINUTES,
  hashSignInCode,
  MAX_CODE_ATTEMPTS,
  MAX_CODES_PER_WINDOW,
  MAX_GUESSES_PER_DAY,
  minutesBefore,
  SIGN_IN_CODE_TTL_MINUTES,
  signInCodeMatches,
  type IssueResult,
  type RedeemResult,
  type SignInCodes,
} from "../sign-in-codes";
import type { AccountRepository, CustomerAccount } from "./account-repository";

type StoredAccount = { id: string; role: Exclude<Role, "GUEST">; email: string; phone: string | null };

let nextAccountId = 0;

/** Thrown when a Customer Account already exists for the email (the unique (email, role) index). */
export class InMemoryEmailTakenError extends Error {}

export class InMemoryAccounts implements AccountRepository {
  readonly accounts: StoredAccount[] = [];

  add(account: Omit<StoredAccount, "id" | "phone"> & { id?: string; phone?: string | null }): StoredAccount {
    const email = account.email.trim().toLowerCase();
    if (this.accounts.some((a) => a.email === email && a.role === account.role)) throw new InMemoryEmailTakenError();
    nextAccountId += 1;
    const stored = { id: account.id ?? `account_${nextAccountId}`, role: account.role, email, phone: account.phone ?? null };
    this.accounts.push(stored);
    return stored;
  }

  async findCustomerByEmail(email: string): Promise<CustomerAccount | null> {
    const found = this.accounts.find((a) => a.role === "CUSTOMER" && a.email === email.trim().toLowerCase());
    return found ? { id: found.id, email: found.email } : null;
  }

  async findCustomerById(accountId: string): Promise<CustomerAccount | null> {
    const found = this.accounts.find((a) => a.role === "CUSTOMER" && a.id === accountId);
    return found ? { id: found.id, email: found.email } : null;
  }
}

type StoredCode = { id: number; accountId: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null; createdAt: Date };

export class InMemorySignInCodes implements SignInCodes {
  readonly codes: StoredCode[] = [];

  constructor(
    private readonly secret: string,
    private readonly generateCode: () => string,
  ) {}

  async issue(accountId: string, now: Date): Promise<IssueResult> {
    const recent = this.codes.filter((c) => c.accountId === accountId && c.createdAt >= minutesBefore(now, CODE_REQUEST_WINDOW_MINUTES));
    if (recent.length >= MAX_CODES_PER_WINDOW || this.guessesToday(accountId, now) >= MAX_GUESSES_PER_DAY) {
      return { rateLimited: true };
    }
    const code = this.generateCode();
    this.codes.push({
      id: this.codes.length + 1,
      accountId,
      codeHash: hashSignInCode(code, this.secret),
      expiresAt: new Date(now.getTime() + SIGN_IN_CODE_TTL_MINUTES * 60_000),
      attempts: 0,
      consumedAt: null,
      createdAt: now,
    });
    return { code };
  }

  async redeem(accountId: string, code: string, now: Date): Promise<RedeemResult> {
    if (this.guessesToday(accountId, now) >= MAX_GUESSES_PER_DAY) return "locked";
    const latest = this.codes.filter((c) => c.accountId === accountId).at(-1);
    if (!latest || latest.consumedAt || latest.expiresAt <= now) return "invalid";
    if (latest.attempts >= MAX_CODE_ATTEMPTS) return "locked";
    latest.attempts += 1;
    if (!signInCodeMatches(code, latest.codeHash, this.secret)) return "invalid";
    latest.consumedAt = now;
    return "ok";
  }

  private guessesToday(accountId: string, now: Date): number {
    return this.codes
      .filter((c) => c.accountId === accountId && c.createdAt >= minutesBefore(now, 24 * 60))
      .reduce((sum, c) => sum + c.attempts, 0);
  }
}
