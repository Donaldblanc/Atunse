import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import type { OrderDetail } from "@/features/admin-overview/order-detail";
import { Money } from "@/shared/money/money";

const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => ADMIN }));
vi.mock("@/features/admin-overview/order-detail-deps", () => ({ buildOrderDetailDeps: () => ({}) }));

const getOrderDetail = vi.fn();
vi.mock("@/features/admin-overview/order-detail", () => ({ getOrderDetail: (...args: unknown[]) => getOrderDetail(...args) }));

class NotFoundSignal extends Error {}
const notFound = vi.fn(() => {
  throw new NotFoundSignal();
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: OrderDetailPage, generateMetadata } = await import("./page");

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

beforeEach(() => {
  getOrderDetail.mockReset();
  notFound.mockClear();
});

describe("OrderDetailPage (/admin/orders/[id])", () => {
  it("shows the not-found page for an id no Order has, instead of crashing", async () => {
    getOrderDetail.mockResolvedValue(null);
    await expect(OrderDetailPage({ params: Promise.resolve({ id: "bogus" }), searchParams: Promise.resolve({}) })).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("renders the order's detail for a real id", async () => {
    getOrderDetail.mockResolvedValue(detail());
    const element = await OrderDetailPage({ params: Promise.resolve({ id: "ord_1" }), searchParams: Promise.resolve({}) });
    expect(notFound).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(element);
    expect(html).toContain("ATU-1001");
    expect(html).toContain("Jordan Smith");
    expect(html).toContain("Edit Order");
    // Read-only view: no edit-form-only fields.
    expect(html).not.toContain("Street address");
  });

  it("swaps in the edit form for ?edit=order, same as the Overview dialog", async () => {
    getOrderDetail.mockResolvedValue(detail());
    const element = await OrderDetailPage({ params: Promise.resolve({ id: "ord_1" }), searchParams: Promise.resolve({ edit: "order" }) });
    const html = renderToStaticMarkup(element);
    // Editing: the edit form is in place of the read-only body, and there's no second "Edit Order" entry point.
    expect(html).not.toContain(">Edit Order<");
    expect(html).toContain("oe-form");
    expect(html).toContain("Street address");
  });

  it("titles the tab with the order's reference", async () => {
    getOrderDetail.mockResolvedValue(detail());
    await expect(generateMetadata({ params: Promise.resolve({ id: "ord_1" }) })).resolves.toEqual({ title: "ATU-1001 · Atunṣe Admin" });
  });
});
