import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OrderDetail } from "./order-detail";
import { Money } from "@/shared/money/money";

// AdminDialog (used by OrderDetailDialog) reads the router to close on Escape/backdrop; not exercised here.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));

const { OrderDetailDialog } = await import("./order-detail-dialog");

function detail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    orderId: "ord_1",
    reference: "ATU-1001",
    bookedAt: new Date("2026-10-01T12:00:00Z"),
    status: "REQUEST_SUBMITTED",
    customer: { name: "Jordan Smith", email: "jordan@example.com", phone: "(212) 555-0142", fulfillment: "Local Drop-Off", schedule: null, address: [] },
    bundleName: null,
    bundlePrice: null,
    pairs: [],
    timeline: [],
    payment: {
      deposit: null,
      balance: null,
      balanceOwed: null,
      estimate: Money.fromCents(8500),
      estimateIsMinimum: false,
      depositDue: Money.fromCents(4250),
      rush: null,
      quoted: null,
    },
    notes: [],
    returnVisit: { kind: "none" },
    edit: { updatedAt: new Date().toISOString(), contactName: "", contactEmail: "", contactPhone: "", line1: "", line2: "", city: "", state: "", zip: "", pairs: [] },
    ...overrides,
  };
}

describe("OrderDetailDialog", () => {
  it("shows 'View full order' and 'Edit Order' in the read-only view", () => {
    const html = renderToStaticMarkup(
      <OrderDetailDialog detail={detail()} closeHref="/admin" viewHref="/admin?order=ord_1" editHref="/admin?order=ord_1&edit=order" fullPageHref="/admin/orders/ord_1" />,
    );
    expect(html).toContain("View full order");
    expect(html).toContain("Edit Order");
  });

  it("hides 'View full order' (and Edit Order) while editing, so unsaved edits can't be discarded by a stray click", () => {
    const html = renderToStaticMarkup(
      <OrderDetailDialog detail={detail()} closeHref="/admin" viewHref="/admin?order=ord_1" editHref="/admin?order=ord_1&edit=order" fullPageHref="/admin/orders/ord_1" editing />,
    );
    expect(html).not.toContain("View full order");
    expect(html).not.toContain(">Edit Order<");
  });
});
