import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { InMemoryInventoryRepository } from "@/features/inventory/repositories/in-memory-inventory-repository";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";

let actingUser: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => actingUser }));

const inventory = new InMemoryInventoryRepository();
const storage = new InMemoryFileStorage();
vi.mock("@/features/inventory/deps", () => ({ buildInventoryDeps: () => ({ inventory, storage }) }));

const { default: AdminInventoryPage } = await import("./page");

const render = async (params: Record<string, string> = {}) => renderToStaticMarkup(await AdminInventoryPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  actingUser = { accountId: "acc_admin", role: "ADMIN" };
  inventory.items.length = 0;
  inventory.suppliers.length = 0;
  inventory.items.push(
    { id: "i1", name: "Crep Spray", description: "Protection spray", sku: "ATU-CP-1", category: "Cleaning", stock: 12, lowStockAt: 5, active: true, supplierId: "s1", images: [{ id: "img1", key: "inventory/i1/a.jpg", position: 0 }] },
    { id: "i2", name: "Mink Oil", sku: "ATU-MO-1", category: "Restoration", stock: 3, lowStockAt: 5, active: true },
    { id: "i3", name: "Cloths", sku: "ATU-MC-1", category: "Supplies", stock: 0, lowStockAt: 5, active: true },
    { id: "i4", name: "Old Brush", sku: "ATU-OB-1", category: "Cleaning", stock: 9, lowStockAt: 5, active: false },
  );
  inventory.suppliers.push({ id: "s1", name: "Crep Co", email: "sales@crep.test", phone: "212-555-0100", website: null, notes: null });
});

describe("AdminInventoryPage", () => {
  it("shows the stat cards without any month-over-month trend", async () => {
    const html = await render();
    expect(html).toContain("Total Items");
    expect(html).toContain("Out of Stock");
    expect(html).not.toContain("vs last");
  });

  it("lists items with status badges, an Inactive badge and a thumbnail", async () => {
    const html = await render();
    expect(html).toContain("Crep Spray");
    expect(html).toContain("ATU-MO-1");
    expect(html).toContain("Low Stock");
    expect(html).toContain("Inactive");
    expect(html).toContain("https://storage.test/signed/inventory/i1/a.jpg");
    expect(html).toContain("/admin/inventory?item=i1");
    expect(html).toContain("Showing 1–4 of 4 items");
  });

  it("filters, keeping the filters in the row links", async () => {
    const html = await render({ category: "Cleaning", status: "INACTIVE" });
    expect(html).toContain("Old Brush");
    expect(html).not.toContain("Crep Spray");
    expect(html).toContain("category=Cleaning&amp;status=INACTIVE&amp;item=i4");
  });

  it("shows the empty state", async () => {
    expect(await render({ q: "nobody-here" })).toContain("No inventory items match these filters.");
  });

  it("rejects a non-admin acting user", async () => {
    actingUser = { accountId: "acc_c", role: "CUSTOMER" };
    await expect(render()).rejects.toThrow();
  });

  it("opens the item panel with Details, then Stock History and Supplier", async () => {
    const details = await render({ item: "i1" });
    expect(details).toContain("Save Changes");
    expect(details).toContain("Adjust stock");
    expect(details).toContain("Deactivate Item");
    expect(details).not.toContain("Delete Item");
    expect(details).toContain("Product Images");

    await inventory.adjustStock({ itemId: "i1", change: 5, reason: "RESTOCK", note: "Delivery", seenStock: 12, actorAccountId: null });
    const history = await render({ item: "i1", tab: "history" });
    expect(history).toContain("Restocked");
    expect(history).toContain("+5");
    expect(history).toContain("Delivery");

    const supplier = await render({ item: "i1", tab: "supplier" });
    expect(supplier).toContain("Crep Co");
    expect(supplier).toContain("sales@crep.test");
    expect(supplier).toContain("Add supplier");
    expect(await render({ item: "i2", tab: "supplier" })).toContain("No supplier");
  });

  it("offers Reactivate for an inactive item", async () => {
    const html = await render({ item: "i4" });
    expect(html).toContain("Reactivate Item");
    expect(html).not.toContain("Deactivate Item");
  });

  it("says so for an unknown item instead of crashing", async () => {
    expect(await render({ item: "nope" })).toContain("Item not found");
  });

  it("opens the Add Item dialog for ?new=1", async () => {
    const html = await render({ new: "1" });
    expect(html).toContain("Add Item");
    expect(html).toContain("Initial Stock");
  });
});
