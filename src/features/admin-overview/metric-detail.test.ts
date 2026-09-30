import { describe, expect, it } from "vitest";
import type { BookedOrder } from "@/features/orders/repositories/order-repository";
import type { ItemStatus } from "@/features/orders/domain";
import { Money } from "@/shared/money/money";
import { metricDetail, parseOverviewMetric } from "./metric-detail";

const DAYS = ["2026-09-28", "2026-09-29", "2026-09-30"];

function booked(createdAt: string, cents: number, ...statuses: ItemStatus[]): BookedOrder {
  const each = Money.fromCents(cents / statuses.length);
  return { id: createdAt + cents, createdAt: new Date(createdAt), estimate: Money.fromCents(cents), items: statuses.map((status) => ({ status, serviceIds: [], estimate: each })) };
}

describe("metricDetail", () => {
  it("counts Orders per day of the range in shop time, empty days as zero", () => {
    const detail = metricDetail(
      [
        booked("2026-09-28T13:00:00Z", 3000, "APPROVED"),
        booked("2026-09-29T02:00:00Z", 3000, "APPROVED"), // 10 PM Monday in New York
        booked("2026-09-30T13:00:00Z", 3000, "APPROVED"),
        booked("2026-09-30T15:00:00Z", 3000, "APPROVED"),
      ],
      DAYS,
    );
    expect(detail.ordersByDay).toEqual([
      { date: "2026-09-28", orders: 2 },
      { date: "2026-09-29", orders: 0 },
      { date: "2026-09-30", orders: 2 },
    ]);
  });

  it("groups live Orders by rollup status in pipeline order, leaving out empty statuses", () => {
    const detail = metricDetail(
      [
        booked("2026-09-28T13:00:00Z", 3000, "COMPLETED"),
        booked("2026-09-28T14:00:00Z", 4000, "IN_PROGRESS"),
        // The Order's least advanced pair sets its status.
        booked("2026-09-29T14:00:00Z", 8000, "COMPLETED", "IN_PROGRESS"),
        booked("2026-09-29T15:00:00Z", 2000, "REQUEST_SUBMITTED"),
      ],
      DAYS,
    );
    expect(detail.byStatus.map((s) => [s.status, s.orders, s.revenue.cents])).toEqual([
      ["REQUEST_SUBMITTED", 1, 2000],
      ["IN_PROGRESS", 2, 12000],
      ["COMPLETED", 1, 3000],
    ]);
  });

  it("keeps fully cancelled Orders out of the days and statuses, counting them apart", () => {
    const detail = metricDetail(
      [booked("2026-09-28T13:00:00Z", 3000, "CANCELLED"), booked("2026-09-28T14:00:00Z", 3000, "APPROVED")],
      DAYS,
    );
    expect(detail.cancelledOrders).toBe(1);
    expect(detail.ordersByDay[0]!.orders).toBe(1);
    expect(detail.byStatus.map((s) => s.status)).toEqual(["APPROVED"]);
  });

  it("drops a cancelled pair's share from a partly cancelled Order's revenue", () => {
    const detail = metricDetail([booked("2026-09-28T13:00:00Z", 6000, "APPROVED", "CANCELLED")], DAYS);
    expect(detail.byStatus).toHaveLength(1);
    expect(detail.byStatus[0]!.revenue.cents).toBe(3000);
    expect(detail.cancelledOrders).toBe(0);
  });

  it("is empty for an empty range", () => {
    expect(metricDetail([], DAYS)).toEqual({ ordersByDay: DAYS.map((date) => ({ date, orders: 0 })), byStatus: [], cancelledOrders: 0 });
  });
});

describe("parseOverviewMetric", () => {
  it("accepts the two metrics and nothing else", () => {
    expect(parseOverviewMetric("orders")).toBe("orders");
    expect(parseOverviewMetric("revenue")).toBe("revenue");
    expect(parseOverviewMetric("x")).toBeNull();
    expect(parseOverviewMetric(undefined)).toBeNull();
  });
});
