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

function pair(overrides: Partial<OrderDetail["pairs"][number]> = {}): OrderDetail["pairs"][number] {
  return {
    itemId: "item_1",
    photo: { kind: "none" } as OrderDetail["pairs"][number]["photo"],
    title: "Nike Air Max 90",
    details: [],
    estimate: Money.fromCents(3000),
    price: null,
    status: "APPROVED",
    displayStatus: "APPROVED",
    requiresQuote: true,
    services: [],
    suedeFee: null,
    nextStatuses: [],
    held: null,
    autoApproved: false,
    ...overrides,
  };
}

describe("OrderDetailDialog", () => {
  it("shows a 'Set price — no quote needed' note for an auto-approved pair (ADR-0017)", () => {
    const html = renderToStaticMarkup(
      <OrderDetailDialog
        detail={detail({ pairs: [pair({ autoApproved: true })] })}
        closeHref="/admin"
        viewHref="/admin?order=ord_1"
        editHref="/admin?order=ord_1&edit=order"
        fullPageHref="/admin/orders/ord_1"
      />,
    );
    expect(html).toContain("Set price — no quote needed");
  });

  it("doesn't show the auto-approved note for a pair that went through a Quote", () => {
    const html = renderToStaticMarkup(
      <OrderDetailDialog
        detail={detail({ pairs: [pair({ autoApproved: false })] })}
        closeHref="/admin"
        viewHref="/admin?order=ord_1"
        editHref="/admin?order=ord_1&edit=order"
        fullPageHref="/admin/orders/ord_1"
      />,
    );
    expect(html).not.toContain("Set price — no quote needed");
  });

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
