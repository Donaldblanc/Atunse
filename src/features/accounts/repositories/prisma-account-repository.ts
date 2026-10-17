import { Prisma, type PrismaClient } from "@prisma/client";
import { AdminEmailTakenError, type AccountRepository, type AdminAccount, CustomerAccount, CustomerDetail, CustomerListRow } from "./account-repository";

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

  async findAdminById(accountId: string): Promise<AdminAccount | null> {
    return this.prisma.account.findFirst({
      where: { id: accountId, role: "ADMIN" },
      select: { id: true, name: true, email: true, passwordHash: true, sessionVersion: true },
    });
  }

  async updateAdminProfile(accountId: string, fields: { name: string | null; email: string }): Promise<number | null> {
    const email = fields.email.trim().toLowerCase();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.account.findFirst({ where: { id: accountId, role: "ADMIN" }, select: { email: true } });
        if (!current) return null;
        const updated = await tx.account.update({
          where: { id: accountId },
          data: { name: fields.name, email, ...(current.email !== email ? { sessionVersion: { increment: 1 } } : {}) },
          select: { sessionVersion: true },
        });
        return updated.sessionVersion;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new AdminEmailTakenError();
      throw err;
    }
  }

  async updateAdminPasswordHash(accountId: string, passwordHash: string): Promise<number | null> {
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.account.findFirst({ where: { id: accountId, role: "ADMIN" }, select: { id: true } });
      if (!found) return null;
      const updated = await tx.account.update({
        where: { id: accountId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
        select: { sessionVersion: true },
      });
      return updated.sessionVersion;
    });
  }

  async findAdminSessionVersion(accountId: string): Promise<number | null> {
    const found = await this.prisma.account.findFirst({ where: { id: accountId, role: "ADMIN" }, select: { sessionVersion: true } });
    return found?.sessionVersion ?? null;
  }

  async bumpAdminSessionVersion(accountId: string): Promise<void> {
    await this.prisma.account.updateMany({ where: { id: accountId, role: "ADMIN" }, data: { sessionVersion: { increment: 1 } } });
  }
}
