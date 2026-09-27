import type { PrismaClient } from "@prisma/client";
import type { AccountRepository, CustomerAccount } from "./account-repository";

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCustomerByEmail(email: string): Promise<CustomerAccount | null> {
    return this.prisma.account.findUnique({
      where: { email_role: { email: email.trim().toLowerCase(), role: "CUSTOMER" } },
      select: { id: true, email: true },
    });
  }

  async findCustomerById(accountId: string): Promise<CustomerAccount | null> {
    return this.prisma.account.findFirst({
      where: { id: accountId, role: "CUSTOMER" },
      select: { id: true, email: true },
    });
  }
}
