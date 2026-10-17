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
import { AdminEmailTakenError, type AccountRepository, type AdminAccount, type CustomerAccount, type CustomerDetail, type CustomerListRow } from "./account-repository";

type StoredAccount = { id: string; role: Exclude<Role, "GUEST">; email: string; name: string | null; phone: string | null; passwordHash?: string | null; sessionVersion: number; createdAt: Date };

let nextAccountId = 0;

/** Thrown when a Customer Account already exists for the email (the unique (email, role) index). */
export class InMemoryEmailTakenError extends Error {}

export class InMemoryAccounts implements AccountRepository {
  readonly accounts: StoredAccount[] = [];

  add(
    account: Omit<StoredAccount, "id" | "phone" | "name" | "createdAt" | "sessionVersion"> & { id?: string; phone?: string | null; name?: string | null; createdAt?: Date },
  ): StoredAccount {
    const email = account.email.trim().toLowerCase();
    if (this.accounts.some((a) => a.email === email && a.role === account.role)) throw new InMemoryEmailTakenError();
    nextAccountId += 1;
    const stored = {
      id: account.id ?? `account_${nextAccountId}`,
      role: account.role,
      email,
      name: account.name ?? null,
      phone: account.phone ?? null,
      passwordHash: account.passwordHash ?? null,
      sessionVersion: 0,
      createdAt: account.createdAt ?? new Date(Date.now() + nextAccountId),
    };
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

  async listCustomers(params?: { limit?: number; offset?: number }): Promise<CustomerListRow[]> {
    const rows = this.accounts
      .filter((a) => a.role === "CUSTOMER")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, createdAt: a.createdAt }));
    const offset = params?.offset ?? 0;
    const limit = params?.limit;
    return limit === undefined ? rows.slice(offset) : rows.slice(offset, offset + limit);
  }

  async findCustomerDetail(accountId: string): Promise<CustomerDetail | null> {
    const found = this.accounts.find((a) => a.role === "CUSTOMER" && a.id === accountId);
    return found ? { id: found.id, name: found.name, email: found.email, phone: found.phone, createdAt: found.createdAt } : null;
  }

  async findAdminById(accountId: string): Promise<AdminAccount | null> {
    const found = this.accounts.find((a) => a.role === "ADMIN" && a.id === accountId);
    return found ? { id: found.id, name: found.name, email: found.email, passwordHash: found.passwordHash ?? null, sessionVersion: found.sessionVersion } : null;
  }

  async updateAdminProfile(accountId: string, fields: { name: string | null; email: string }): Promise<void> {
    const found = this.accounts.find((a) => a.role === "ADMIN" && a.id === accountId);
    if (!found) return;
    const email = fields.email.trim().toLowerCase();
    if (this.accounts.some((a) => a.role === "ADMIN" && a.id !== accountId && a.email === email)) throw new AdminEmailTakenError();
    found.name = fields.name;
    if (found.email !== email) found.sessionVersion += 1;
    found.email = email;
  }

  async updateAdminPasswordHash(accountId: string, passwordHash: string): Promise<void> {
    const found = this.accounts.find((a) => a.role === "ADMIN" && a.id === accountId);
    if (!found) return;
    found.passwordHash = passwordHash;
    found.sessionVersion += 1;
  }

  async findAdminSessionVersion(accountId: string): Promise<number | null> {
    return this.accounts.find((a) => a.role === "ADMIN" && a.id === accountId)?.sessionVersion ?? null;
  }

  async bumpAdminSessionVersion(accountId: string): Promise<void> {
    const found = this.accounts.find((a) => a.role === "ADMIN" && a.id === accountId);
    if (found) found.sessionVersion += 1;
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
