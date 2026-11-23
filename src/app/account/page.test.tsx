import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { DEFAULT_CATALOG } from "@/features/orders/default-catalog";
import { submitOrder } from "@/features/orders/use-cases/submit-order";
import { bookingDeps, validBookingInput } from "@/features/orders/use-cases/test-fixtures";

let actingUser: ActingUser = { accountId: null, role: "GUEST" };
let flagOn = true;
const booking = bookingDeps();

vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/account",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/accounts/acting-user", () => ({ customerFromCookies: async () => actingUser }));
vi.mock("@/shared/config/feature-flags", () => ({ isCustomerSignInEnabled: () => flagOn }));
vi.mock("@/features/landing/site-nav", () => ({ SiteNav: () => null }));
vi.mock("@/features/landing/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/features/landing/mobile-tabbar", () => ({ MobileTabBar: () => null }));
vi.mock("@/features/orders/deps", () => ({
  buildOrderUseCaseDeps: () => ({ orders: booking.orders, catalog: { load: async () => DEFAULT_CATALOG }, storage: booking.storage }),
}));

const { default: AccountPage } = await import("./page");

describe("AccountPage", () => {
  beforeEach(() => {
    actingUser = { accountId: null, role: "GUEST" };
    flagOn = true;
    booking.orders.orders.clear();
    delete process.env.CONTACT_EMAIL;
  });

  it("answers 404 while customer sign-in is off", async () => {
    flagOn = false;
    await expect(AccountPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("asks a signed-out visitor to sign in with an email code", async () => {
    const html = renderToStaticMarkup(await AccountPage());
    expect(html).toContain("Email me a code");
    expect(html).not.toContain("Book a restoration");
  });

  it("shows the empty state to a customer with no bookings", async () => {
    actingUser = { accountId: "acc_none", role: "CUSTOMER" };
    const html = renderToStaticMarkup(await AccountPage());
    expect(html).toContain("Book a restoration");
  });

  it("renders the customer's order with the email-us line", async () => {
    process.env.CONTACT_EMAIL = "hello@example.com";
    const order = await submitOrder(booking, { accountId: null, role: "GUEST" }, validBookingInput());
    actingUser = { accountId: order.accountId, role: "CUSTOMER" };
    const html = renderToStaticMarkup(await AccountPage());
    expect(html).toContain(`ATU-${order.number}`);
    expect(html).toContain("Local Drop-Off");
    expect(html).toContain("Standard Clean");
    expect(html).toContain("Need to change or cancel?");
    expect(html).toContain("hello@example.com");
    expect(html).not.toMatch(/pickup/i);
  });
});
