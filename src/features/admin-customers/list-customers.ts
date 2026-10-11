// The admin Customers screen's list (/admin/customers): every Customer
// Account, most recently created first, with how many Orders each has
// booked. Admin-only (ADR-0012); never imports Prisma (ADR-0003/0011).

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { AccountRepository } from "@/features/accounts/repositories/account-repository";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";

export interface CustomerRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
  orderCount: number;
}

export interface ListCustomersDeps {
  accounts: Pick<AccountRepository, "listCustomers">;
  orders: Pick<OrderRepository, "countByAccountId">;
}

/** Customers list's default page size, so one admin's load never pulls every Account at once. */
export const CUSTOMERS_PAGE_SIZE = 50;

export async function listCustomers(
  deps: ListCustomersDeps,
  actingUser: ActingUser,
  params: { limit?: number; offset?: number } = {},
): Promise<CustomerRow[]> {
  requireRole(actingUser, "ADMIN");

  const limit = params.limit ?? CUSTOMERS_PAGE_SIZE;
  const offset = params.offset ?? 0;
  const customers = await deps.accounts.listCustomers({ limit, offset });
  return Promise.all(
    customers.map(async (customer) => ({
      ...customer,
      orderCount: await deps.orders.countByAccountId(customer.id),
    })),
  );
}
