// Test doubles for the accounts repositories (use-case unit tests).

import type { AccountRecord, AccountRepository } from "./account-repository";
import type { SignInCodeRecord, SignInCodeRepository } from "./sign-in-code-repository";

export class InMemoryAccountRepository implements AccountRepository {
  readonly accounts: AccountRecord[] = [];

  add(account: AccountRecord): AccountRecord {
    this.accounts.push(account);
    return account;
  }

  async findByEmail(email: string): Promise<AccountRecord | null> {
    return this.accounts.find((a) => a.email === email.trim().toLowerCase()) ?? null;
  }
}

export class InMemorySignInCodeRepository implements SignInCodeRepository {
  readonly codes: (SignInCodeRecord & { createdAt: Date })[] = [];
  private nextId = 0;

  constructor(private readonly now: () => Date) {}

  async create(params: { accountId: string; codeHash: string; expiresAt: Date }): Promise<void> {
    this.nextId += 1;
    this.codes.push({ id: `code_${this.nextId}`, attempts: 0, consumedAt: null, createdAt: this.now(), ...params });
  }

  async countCreatedSince(accountId: string, since: Date): Promise<number> {
    return this.codes.filter((c) => c.accountId === accountId && c.createdAt >= since).length;
  }

  async findLatest(accountId: string): Promise<SignInCodeRecord | null> {
    return this.codes.filter((c) => c.accountId === accountId).at(-1) ?? null;
  }

  async recordAttempt(codeId: string, maxAttempts: number): Promise<boolean> {
    const code = this.codes.find((c) => c.id === codeId);
    if (!code || code.attempts >= maxAttempts) return false;
    code.attempts += 1;
    return true;
  }

  async consume(codeId: string, at: Date): Promise<boolean> {
    const code = this.codes.find((c) => c.id === codeId);
    if (!code || code.consumedAt) return false;
    code.consumedAt = at;
    return true;
  }
}
