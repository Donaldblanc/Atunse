export interface SignInCodeRecord {
  id: string;
  accountId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

export interface SignInCodeRepository {
  create(params: { accountId: string; codeHash: string; expiresAt: Date }): Promise<void>;
  countCreatedSince(accountId: string, since: Date): Promise<number>;
  /** The account's most recent code; requesting a new code retires older ones. */
  findLatest(accountId: string): Promise<SignInCodeRecord | null>;
  /**
   * Atomically counts one guess against the code. Returns false, counting
   * nothing, once `maxAttempts` guesses have been made.
   */
  recordAttempt(codeId: string, maxAttempts: number): Promise<boolean>;
  /** Atomically marks the code used. Returns false if it already was. */
  consume(codeId: string, at: Date): Promise<boolean>;
}
