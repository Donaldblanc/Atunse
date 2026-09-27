import type { PrismaClient } from "@prisma/client";
import type { AccountRecord, AccountRepository } from "./account-repository";

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<AccountRecord | null> {
    const row = await this.prisma.account.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, role: true, email: true },
    });
    return row;
  }
}
