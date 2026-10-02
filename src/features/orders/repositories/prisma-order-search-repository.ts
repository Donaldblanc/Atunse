import type { Prisma, PrismaClient } from "@prisma/client";
import { Money } from "@/shared/money/money";
import { ITEM_STATUSES, type ItemStatus } from "../domain";
import { orderNumberFromQuery, phoneDigitsFromQuery, type OrderSearchFilters, type OrderSearchRepository, type OrderSearchRow } from "./order-search-repository";

/**
 * An Order's derived status (orderRollupStatus) is its least advanced pair
 * that isn't cancelled, and Cancelled only when every pair is. So an Order
 * is at `status` when some pair is there and no live pair is earlier.
 */
function statusWhere(status: ItemStatus): Prisma.OrderWhereInput {
  if (status === "CANCELLED") return { items: { some: {}, every: { status: "CANCELLED" } } };
  const earlier = ITEM_STATUSES.slice(0, ITEM_STATUSES.indexOf(status));
  return { items: { some: { status }, none: { status: { in: earlier } } } };
}

/** Prisma's `contains` passes LIKE wildcards through, so a "%" or "_" typed by the owner would match everything: match them literally. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/** `phoneMatches`: Orders whose phone holds the query's digits once formatting is ignored (see searchOrders). */
function whereFor(filters: OrderSearchFilters, phoneMatches: string[]): Prisma.OrderWhereInput {
  const clauses: Prisma.OrderWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    // `contains` is parameterized, so the text can't change the query.
    const number = orderNumberFromQuery(q);
    clauses.push({
      OR: [
        ...(number === null ? [] : [{ number }]),
        { contactName: { contains: escapeLike(q), mode: "insensitive" } },
        { contactEmail: { contains: escapeLike(q), mode: "insensitive" } },
        { contactPhone: { contains: escapeLike(q), mode: "insensitive" } },
        ...(phoneMatches.length > 0 ? [{ id: { in: phoneMatches } }] : []),
      ],
    });
  }
  if (filters.status) clauses.push(statusWhere(filters.status));
  if (filters.from || filters.to) clauses.push({ createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lt: filters.to }) } });
  if (filters.serviceId) clauses.push({ items: { some: { serviceIds: { has: filters.serviceId } } } });
  return { AND: clauses };
}

export class PrismaOrderSearchRepository implements OrderSearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async searchOrders(filters: OrderSearchFilters): Promise<{ rows: OrderSearchRow[]; total: number }> {
    // Prisma can't strip a column's formatting in a where, so phone digits are matched in SQL first.
    // The digits are bound as a parameter and are only 0-9, so the LIKE pattern holds no wildcards of the owner's.
    const digits = filters.q ? phoneDigitsFromQuery(filters.q) : null;
    const phoneMatches = digits
      ? (await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE regexp_replace("contactPhone", '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`).map((row) => row.id)
      : [];
    const where = whereFor(filters, phoneMatches);
    const [total, found] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          number: true,
          contactName: true,
          createdAt: true,
          estimateCents: true,
          estimateIsMinimum: true,
          items: { select: { status: true, serviceIds: true, estimateCents: true }, orderBy: { position: "asc" } },
          payments: { where: { kind: "DEPOSIT" }, select: { method: true, status: true }, take: 1 },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: filters.offset,
        take: filters.limit,
      }),
    ]);
    const rows = found.map(
      (order): OrderSearchRow => ({
        orderId: order.id,
        number: order.number,
        contactName: order.contactName,
        bookedAt: order.createdAt,
        estimate: Money.fromCents(order.estimateCents),
        estimateIsMinimum: order.estimateIsMinimum,
        items: order.items.map((item) => ({ status: item.status, serviceIds: item.serviceIds, estimate: Money.fromCents(item.estimateCents) })),
        deposit: order.payments[0] ?? null,
      }),
    );
    return { rows, total };
  }
}
