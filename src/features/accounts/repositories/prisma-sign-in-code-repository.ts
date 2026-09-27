import type { PrismaClient } from "@prisma/client";
import type { SignInCodeRecord, SignInCodeRepository } from "./sign-in-code-repository";

export class PrismaSignInCodeRepository implements SignInCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: { accountId: string; codeHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.signInCode.create({ data: params });
  }

  async countCreatedSince(accountId: string, since: Date): Promise<number> {
    return this.prisma.signInCode.count({ where: { accountId, createdAt: { gte: since } } });
  }

  async findLatest(accountId: string): Promise<SignInCodeRecord | null> {
    return this.prisma.signInCode.findFirst({ where: { accountId }, orderBy: { createdAt: "desc" } });
  }

  async recordAttempt(codeId: string, maxAttempts: number): Promise<boolean> {
    // One conditional UPDATE, so parallel guesses can't exceed the limit.
    const { count } = await this.prisma.signInCode.updateMany({
      where: { id: codeId, attempts: { lt: maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    return count === 1;
  }

  async consume(codeId: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.signInCode.updateMany({
      where: { id: codeId, consumedAt: null },
      data: { consumedAt: at },
    });
    return count === 1;
  }
}
