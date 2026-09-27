import type { PrismaClient } from "@prisma/client";
import {
  CODE_REQUEST_WINDOW_MINUTES,
  generateSignInCode,
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

export class PrismaSignInCodes implements SignInCodes {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly secret: string,
    private readonly generateCode: () => string = generateSignInCode,
  ) {}

  async issue(accountId: string, now: Date): Promise<IssueResult> {
    const recentCodes = await this.prisma.signInCode.count({
      where: { accountId, createdAt: { gte: minutesBefore(now, CODE_REQUEST_WINDOW_MINUTES) } },
    });
    if (recentCodes >= MAX_CODES_PER_WINDOW || (await this.guessesToday(accountId, now)) >= MAX_GUESSES_PER_DAY) {
      return { rateLimited: true };
    }

    const code = this.generateCode();
    await this.prisma.signInCode.create({
      data: {
        accountId,
        codeHash: hashSignInCode(code, this.secret),
        expiresAt: new Date(now.getTime() + SIGN_IN_CODE_TTL_MINUTES * 60_000),
        createdAt: now,
      },
    });
    return { code };
  }

  async redeem(accountId: string, code: string, now: Date): Promise<RedeemResult> {
    if ((await this.guessesToday(accountId, now)) >= MAX_GUESSES_PER_DAY) return "locked";

    const latest = await this.prisma.signInCode.findFirst({ where: { accountId }, orderBy: { createdAt: "desc" } });
    if (!latest || latest.consumedAt || latest.expiresAt <= now) return "invalid";

    // One conditional UPDATE per step, so parallel guesses can neither
    // exceed the per-code limit nor redeem the same code twice.
    const counted = await this.prisma.signInCode.updateMany({
      where: { id: latest.id, attempts: { lt: MAX_CODE_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) return "locked";
    if (!signInCodeMatches(code, latest.codeHash, this.secret)) return "invalid";

    const consumed = await this.prisma.signInCode.updateMany({
      where: { id: latest.id, consumedAt: null },
      data: { consumedAt: now },
    });
    return consumed.count === 1 ? "ok" : "invalid";
  }

  private async guessesToday(accountId: string, now: Date): Promise<number> {
    const { _sum } = await this.prisma.signInCode.aggregate({
      where: { accountId, createdAt: { gte: minutesBefore(now, 24 * 60) } },
      _sum: { attempts: true },
    });
    return _sum.attempts ?? 0;
  }
}
