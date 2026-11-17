import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { InMemoryCatalogRepository } from "@/features/services/repositories/in-memory-catalog-repository";

let actingUser: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => actingUser }));

const catalog = new InMemoryCatalogRepository();
vi.mock("@/features/services/deps", () => ({ buildCatalogDeps: () => ({ catalog, storage: {} }) }));

const { default: AdminServicesPage } = await import("./page");

function service(overrides: Partial<Parameters<typeof catalog.services.set>[1]> = {}) {
  return {
    id: "standard",
    name: "Standard Clean",
    description: "Deep clean, sanitize, and refresh.",
    category: "CLEANING" as const,
    isCleaningTier: true,
    isAddOn: false,
    baseCents: 3000,
    isMinimum: false,
    suedeFeeCents: 1000,
    minimumLabel: null,
    alsoFrom: [],
    internalNotes: null,
    active: true,
    position: 0,
    images: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("AdminServicesPage", () => {
  beforeEach(() => {
    actingUser = { accountId: "acc_admin", role: "ADMIN" };
    catalog.services.clear();
    catalog.bundles.clear();
  });

  it("rejects a non-admin acting user", async () => {
    actingUser = { accountId: "acc_c", role: "CUSTOMER" };
    await expect(AdminServicesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow();
  });

  it("lists services on the All Services tab", async () => {
    catalog.services.set("standard", service());
    const html = renderToStaticMarkup(await AdminServicesPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Standard Clean");
    expect(html).toContain("$30");
  });

  it("shows the Bundles tab's Add Bundle button", async () => {
    const html = renderToStaticMarkup(await AdminServicesPage({ searchParams: Promise.resolve({ tab: "bundles" }) }));
    expect(html).toContain("Add Bundle");
  });

  it("renders Categories as coming soon", async () => {
    const html = renderToStaticMarkup(await AdminServicesPage({ searchParams: Promise.resolve({ tab: "categories" }) }));
    expect(html).toContain("coming soon");
  });

  it("opens the Edit Service dialog for ?edit=<id>", async () => {
    catalog.services.set("standard", service());
    const html = renderToStaticMarkup(await AdminServicesPage({ searchParams: Promise.resolve({ edit: "standard" }) }));
    expect(html).toContain("Edit Service");
    expect(html).toContain('value="Standard Clean"');
  });

  it("filters Additional Services to the ADDITIONAL category", async () => {
    catalog.services.set("standard", service());
    catalog.services.set("laces", service({ id: "laces", name: "Lace Replacement", category: "ADDITIONAL", isCleaningTier: false, isAddOn: true, baseCents: 1500, suedeFeeCents: 0 }));
    const html = renderToStaticMarkup(await AdminServicesPage({ searchParams: Promise.resolve({ tab: "additional" }) }));
    expect(html).toContain("Lace Replacement");
    expect(html).not.toContain("Standard Clean");
  });

  it("badges a bundle that has a promotion end date", async () => {
    const bundle = { id: "fall-boots", name: "Fall Boots", priceCents: 9000, perks: [], pairServiceIds: ["premium"], endsAt: new Date("2026-12-22T05:00:00Z"), internalNotes: null, active: true, position: 0, images: [], createdAt: new Date(), updatedAt: new Date() };
    catalog.bundles.set("fall-boots", bundle);
    catalog.bundles.set("plain", { ...bundle, id: "plain", name: "Plain Pack", position: 1, endsAt: null });
    const html = renderToStaticMarkup(await AdminServicesPage({ searchParams: Promise.resolve({ tab: "bundles" }) }));
    expect(html).toContain("Promotion · ends Dec 21, 2026");
    expect(html.match(/Promotion/g)).toHaveLength(1);
  });
});
