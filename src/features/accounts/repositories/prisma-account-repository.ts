import type { PrismaClient } from "@prisma/client";
import type { AccountRepository, CustomerAccount, CustomerDetail, CustomerListRow } from "./account-repository";

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

  async listCustomers(params?: { limit?: number; offset?: number }): Promise<CustomerListRow[]> {
    return this.prisma.account.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: params?.limit,
      skip: params?.offset,
    });
  }

  async findCustomerDetail(accountId: string): Promise<CustomerDetail | null> {
    return this.prisma.account.findFirst({
      where: { id: accountId, role: "CUSTOMER" },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });
  }
}
