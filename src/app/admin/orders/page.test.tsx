import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { InMemoryOrderRepository } from "@/features/orders/repositories/in-memory-order-repository";
import { InMemoryOrderSearchRepository } from "@/features/orders/repositories/in-memory-order-search-repository";
import type { NewOrderInput } from "@/features/orders/repositories/order-repository";
import { Money } from "@/shared/money/money";

let actingUser: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => actingUser }));

const orders = new InMemoryOrderRepository();
vi.mock("@/features/admin-overview/find-orders-deps", () => ({
  buildFindOrdersDeps: () => ({ orderSearch: new InMemoryOrderSearchRepository(orders) }),
}));

const { default: AdminOrdersPage } = await import("./page");

let photoSeq = 0;

function order(overrides: Partial<NewOrderInput> = {}): NewOrderInput {
  const key = `photos/${++photoSeq}.jpg`;
  return {
    owner: { newCustomer: { email: "jordan@example.com", phone: "2125550142" } },
    contactName: "Jordan Smith",
    contactEmail: "jordan@example.com",
    contactPhone: "2125550142",
    policyAcceptedAt: new Date(),
    terms: { version: "v1", url: "/terms.pdf", sha256: "x", acknowledgments: {} },
    fulfillment: {
      method: "MAIL_IN",
      address: { line1: "1 Main St", line2: null, city: "Austin", state: "TX", zip: "73301" },
      preferredDate: null,
    },
    rush: false,
    estimate: Money.fromCents(3000),
    estimateIsMinimum: false,
    deposit: Money.fromCents(1500),
    depositPayment: { method: "ZELLE", amount: Money.fromCents(1500) },
    collection: null,
    submissionKey: null,
    submissionFingerprint: null,
    bundleId: null,
    alertBody: "Jordan · Standard Clean · Mail-In",
    items: [
      {
        brand: "Nike",
        model: "Air Max 90",
        description: null,
        material: null,
        serviceIds: ["standard"],
        estimate: Money.fromCents(3000),
        requiresQuote: true,
        photos: [{ key, uploadKey: `bookings/${photoSeq}.jpg` }],
      },
    ],
    ...overrides,
  };
}

describe("AdminOrdersPage", () => {
  beforeEach(() => {
    actingUser = { accountId: "acc_admin", role: "ADMIN" };
  });

  it("lists orders and links each row to /admin/orders/[id]", async () => {
    const { order: booked } = await orders.create(order());
    const html = renderToStaticMarkup(await AdminOrdersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Jordan Smith");
    expect(html).toContain(`href="/admin/orders/${booked.id}"`);
  });

  it("rejects a non-admin acting user", async () => {
    actingUser = { accountId: "acc_c", role: "CUSTOMER" };
    await expect(AdminOrdersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });

  it("shows the empty state when no orders match", async () => {
    const html = renderToStaticMarkup(await AdminOrdersPage({ searchParams: Promise.resolve({ q: "nobody-here" }) }));
    expect(html).toContain("No orders match.");
  });

  it("carries q, status, day and service through the status tabs, the search form and the pager", async () => {
    const html = renderToStaticMarkup(
      await AdminOrdersPage({
        searchParams: Promise.resolve({ q: "Jordan", status: "IN_PROGRESS", day: "2026-10-01", service: "standard" }),
      }),
    );
    // The status tab links (e.g. "All") must keep q/day/service alongside the new status.
    expect(html).toContain("q=Jordan");
    expect(html).toContain("day=2026-10-01");
    expect(html).toContain("service=standard");
    // The search form resubmits status/day/service as hidden fields.
    expect(html).toContain('name="status" value="IN_PROGRESS"');
    expect(html).toContain('name="day" value="2026-10-01"');
    expect(html).toContain('name="service" value="standard"');
  });

  it("resets to page 1 when a status tab link is built from a later page", async () => {
    for (let i = 0; i < 11; i++) {
      await orders.create(order({ contactName: `Customer ${i}`, contactEmail: `customer${i}@example.com`, owner: { newCustomer: { email: `customer${i}@example.com`, phone: "2125550142" } } }));
    }
    const html = renderToStaticMarkup(await AdminOrdersPage({ searchParams: Promise.resolve({ page: "2" }) }));
    // The "All" tab and other status tabs never carry a page override, so they always point at page 1 (no "page=" param).
    const tabsSection = html.slice(html.indexOf('aria-label="Order status"'), html.indexOf("</nav>"));
    expect(tabsSection).not.toContain("page=");
  });

  it("shows Previous and Next once there are more than 10 orders", async () => {
    for (let i = 0; i < 11; i++) {
      await orders.create(
        order({ contactName: `Customer ${i}`, contactEmail: `pager${i}@example.com`, owner: { newCustomer: { email: `pager${i}@example.com`, phone: "2125550142" } } }),
      );
    }
    const html = renderToStaticMarkup(await AdminOrdersPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Next");
    expect(html).toMatch(/Page 1 of \d+/);

    const page2 = renderToStaticMarkup(await AdminOrdersPage({ searchParams: Promise.resolve({ page: "2" }) }));
    expect(page2).toContain("Previous");
  });
});
