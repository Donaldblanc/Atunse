// Test double for OrderSearchRepository: reads the orders an
// InMemoryOrderRepository holds, applying the same rules as the Prisma one.

import { orderRollupStatus } from "../domain";
import type { InMemoryOrderRepository } from "./in-memory-order-repository";
import { orderNumberFromQuery, type OrderSearchFilters, type OrderSearchRepository, type OrderSearchRow } from "./order-search-repository";

export class InMemoryOrderSearchRepository implements OrderSearchRepository {
  constructor(private readonly orders: InMemoryOrderRepository) {}

  async searchOrders(filters: OrderSearchFilters): Promise<{ rows: OrderSearchRow[]; total: number }> {
    const needle = filters.q?.trim().toLowerCase() ?? "";
    const number = needle ? orderNumberFromQuery(needle) : null;
    const matches = [...this.orders.orders.values()]
      .filter((order) => {
        if (needle) {
          const text = [order.contactName, order.contactEmail, order.contactPhone].some((field) => field.toLowerCase().includes(needle));
          if (!text && order.number !== number) return false;
        }
        if (filters.status && orderRollupStatus(order.items) !== filters.status) return false;
        if (filters.from && order.createdAt < filters.from) return false;
        if (filters.to && order.createdAt >= filters.to) return false;
        if (filters.serviceId && !order.items.some((item) => item.serviceIds.includes(filters.serviceId!))) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.number - a.number);

    const rows = matches.slice(filters.offset, filters.offset + filters.limit).map((order): OrderSearchRow => {
      const deposit = order.payments.find((payment) => payment.kind === "DEPOSIT");
      return {
        orderId: order.id,
        number: order.number,
        contactName: order.contactName,
        bookedAt: order.createdAt,
        estimate: order.estimate,
        estimateIsMinimum: order.estimateIsMinimum,
        items: order.items.map((item) => ({ status: item.status, serviceIds: item.serviceIds, estimate: item.estimate })),
        deposit: deposit ? { method: deposit.method, status: deposit.status } : null,
      };
    });
    return { rows, total: matches.length };
  }
}
