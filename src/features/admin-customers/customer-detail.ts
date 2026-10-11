// The admin Customers screen's detail (/admin/customers/[id]): one
// Customer Account's contact details and its Order history, newest first.
// Admin-only (ADR-0012); never imports Prisma (ADR-0003/0011).

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { AccountRepository } from "@/features/accounts/repositories/account-repository";
import { orderDisplayStatus, orderNumber, type ItemStatus } from "@/features/orders/domain";
import type { OrderRepository } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";

export interface CustomerOrderRow {
  orderId: string;
  reference: string;
  createdAt: Date;
  status: ItemStatus;
  estimate: Money;
}

export interface CustomerDetail {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
  orders: CustomerOrderRow[];
}

export interface CustomerDetailDeps {
  accounts: Pick<AccountRepository, "findCustomerDetail">;
  orders: Pick<OrderRepository, "listByAccountId">;
}

/** Null for an id no Customer Account has, so a stale or mistyped link shows "not found" instead of failing the page. */
export async function getCustomerDetail(deps: CustomerDetailDeps, actingUser: ActingUser, accountId: string): Promise<CustomerDetail | null> {
  requireRole(actingUser, "ADMIN");

  const customer = await deps.accounts.findCustomerDetail(accountId);
  if (!customer) return null;

  const orders = await deps.orders.listByAccountId(accountId);
  return {
    ...customer,
    orders: orders.map((order) => ({
      orderId: order.id,
      reference: orderNumber(order.number),
      createdAt: order.createdAt,
      status: orderDisplayStatus(order.items),
      estimate: order.estimate,
    })),
  };
}
