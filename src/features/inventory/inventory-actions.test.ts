import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingUser } from "@/features/accounts/authz";
import { InMemoryInventoryRepository } from "./repositories/in-memory-inventory-repository";
import type { InventoryFormState } from "./inventory-form";

let actingUser: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
const revalidatePath = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("next/headers", () => ({ cookies: async () => new Map() }));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/features/accounts/acting-user", () => ({ actingUserFromCookies: async () => actingUser }));

let inventory = new InMemoryInventoryRepository();
vi.mock("./deps", () => ({ buildInventoryDeps: () => ({ inventory }) }));

const { createInventoryItemAction, updateInventoryItemAction, setInventoryItemActiveAction, adjustInventoryStockAction, createSupplierAction, removeInventoryImageAction } = await import("./inventory-actions");

const fresh: InventoryFormState = { error: null, done: 0 };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  idempotencyKey: "k1",
  name: "Crep Spray",
  description: "",
  category: "Cleaning",
  sku: "ATU-CP-1",
  brand: "Crep",
  supplierId: "",
  unitCostDollars: "8.50",
  sellingPriceDollars: "",
  initialStock: "12",
  lowStockAt: "5",
};

beforeEach(() => {
  actingUser = { accountId: "acc_admin", role: "ADMIN" };
  inventory = new InMemoryInventoryRepository();
  revalidatePath.mockClear();
  redirect.mockClear();
});

describe("createInventoryItemAction", () => {
  it("turns dollars into cents, blanks into null, and redirects to the new item's panel", async () => {
    await expect(createInventoryItemAction(fresh, form(valid))).rejects.toThrow(/REDIRECT \/admin\/inventory\?item=/);
    expect(inventory.items).toHaveLength(1);
    const item = await inventory.getItem(inventory.items[0]!.id);
    expect(item).toMatchObject({ name: "Crep Spray", unitCostCents: 850, sellingPriceCents: null, stock: 12, lowStockAt: 5, active: true });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/inventory");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("explains bad input without writing", async () => {
    expect(await createInventoryItemAction(fresh, form({ ...valid, unitCostDollars: "abc" }))).toEqual({ error: "Unit cost must be a price like 8.50.", done: 0 });
    expect(await createInventoryItemAction(fresh, form({ ...valid, sellingPriceDollars: "1e3" }))).toMatchObject({ error: "Selling price must be a price like 8.50." });
    expect(await createInventoryItemAction(fresh, form({ ...valid, name: " " }))).toMatchObject({ error: expect.stringContaining("Item name") });
    expect(await createInventoryItemAction(fresh, form({ ...valid, category: "Nope" }))).toMatchObject({ error: "Pick a valid category." });
    expect(await createInventoryItemAction(fresh, form({ ...valid, lowStockAt: "x" }))).toMatchObject({ error: expect.stringContaining("Low stock alert") });
    expect(await createInventoryItemAction(fresh, form({ ...valid, initialStock: "-1" }))).toMatchObject({ error: expect.stringContaining("Initial stock") });
    expect(await createInventoryItemAction(fresh, form({ ...valid, idempotencyKey: "" }))).toMatchObject({ error: "That request wasn't valid. Reload and try again." });
    expect(inventory.items).toHaveLength(0);
  });

  it("reports a taken SKU", async () => {
    await expect(createInventoryItemAction(fresh, form(valid))).rejects.toThrow(/REDIRECT/);
    expect(await createInventoryItemAction(fresh, form({ ...valid, idempotencyKey: "k2" }))).toEqual({ error: "Another item already uses that SKU.", done: 0 });
  });

  it("reports an ended session for a non-admin", async () => {
    actingUser = { accountId: "c", role: "CUSTOMER" };
    expect(await createInventoryItemAction(fresh, form(valid))).toEqual({ error: "You need to be signed in as an admin to do that.", done: 0 });
  });
});

describe("updateInventoryItemAction", () => {
  async function seed() {
    await expect(createInventoryItemAction(fresh, form(valid))).rejects.toThrow(/REDIRECT/);
    const item = (await inventory.getItem(inventory.items[0]!.id))!;
    return { item, edit: { itemId: item.id, updatedAt: item.updatedAt.toISOString(), active: "true", ...valid } };
  }

  it("saves, keeps stock, and refuses a stale form", async () => {
    const { item, edit } = await seed();
    expect(await updateInventoryItemAction(fresh, form({ ...edit, name: "Crep Spray 2", initialStock: "999" }))).toEqual({ error: null, done: 1 });
    const saved = (await inventory.getItem(item.id))!;
    expect(saved).toMatchObject({ name: "Crep Spray 2", stock: 12 });
    expect(await updateInventoryItemAction(fresh, form(edit))).toEqual({ error: "This was changed elsewhere. Reload and try again.", done: 0 });
    expect(await updateInventoryItemAction(fresh, form({ ...edit, updatedAt: "nonsense" }))).toMatchObject({ error: "This was changed elsewhere. Reload and try again." });
  });

  it("says when the item is gone", async () => {
    const { edit } = await seed();
    expect(await updateInventoryItemAction(fresh, form({ ...edit, itemId: "missing" }))).toEqual({ error: "This item no longer exists.", done: 0 });
    expect(await updateInventoryItemAction(fresh, form({ ...edit, itemId: "../x" }))).toMatchObject({ error: "That request wasn't valid. Reload and try again." });
  });
});

describe("setInventoryItemActiveAction", () => {
  it("deactivates and redirects only to an /admin URL", async () => {
    await expect(createInventoryItemAction(fresh, form(valid))).rejects.toThrow(/REDIRECT/);
    const id = inventory.items[0]!.id;
    redirect.mockClear();
    await expect(setInventoryItemActiveAction(fresh, form({ itemId: id, active: "false", returnTo: "https://evil.example/" }))).rejects.toThrow("REDIRECT /admin/inventory");
    expect(inventory.items[0]!.active).toBe(false);
    await expect(setInventoryItemActiveAction(fresh, form({ itemId: id, active: "true", returnTo: `/admin/inventory?item=${id}` }))).rejects.toThrow(`REDIRECT /admin/inventory?item=${id}`);
    expect(inventory.items[0]!.active).toBe(true);
  });

  it("says when the item is gone", async () => {
    expect(await setInventoryItemActiveAction(fresh, form({ itemId: "missing", active: "false" }))).toEqual({ error: "This item no longer exists.", done: 0 });
  });
});

describe("adjustInventoryStockAction", () => {
  const adjust = { itemId: "i1", seenStock: "4", change: "10", reason: "RESTOCK", note: "Delivery", idempotencyKey: "k" };

  beforeEach(() => {
    inventory.items.push({ id: "i1", name: "Laces", sku: "L", category: "Laces", stock: 4, lowStockAt: 5, active: true });
  });

  it("applies the change and revalidates the screen and the Overview", async () => {
    expect(await adjustInventoryStockAction(fresh, form(adjust))).toEqual({ error: null, done: 1 });
    expect(inventory.items[0]!.stock).toBe(14);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/inventory");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("refuses a replay or stale tab, a zero change and bad input", async () => {
    await adjustInventoryStockAction(fresh, form(adjust));
    expect(await adjustInventoryStockAction(fresh, form(adjust))).toMatchObject({ error: expect.stringContaining("Stock changed to 14") });
    expect(await adjustInventoryStockAction(fresh, form({ ...adjust, seenStock: "14", change: "0" }))).toMatchObject({ error: "Enter a whole number other than 0." });
    expect(await adjustInventoryStockAction(fresh, form({ ...adjust, seenStock: "14", change: "1.5" }))).toMatchObject({ error: "Enter a whole number other than 0." });
    expect(await adjustInventoryStockAction(fresh, form({ ...adjust, seenStock: "14", change: "-99" }))).toMatchObject({ error: expect.stringContaining("below 0") });
    expect(await adjustInventoryStockAction(fresh, form({ ...adjust, idempotencyKey: "" }))).toMatchObject({ error: "That request wasn't valid. Reload and try again." });
    expect(inventory.items[0]!.stock).toBe(14);
  });

  it("rejects a non-admin before reading", async () => {
    actingUser = { accountId: "c", role: "CUSTOMER" };
    await expect(adjustInventoryStockAction(fresh, form(adjust))).rejects.toThrow();
    expect(inventory.items[0]!.stock).toBe(4);
  });
});

describe("createSupplierAction", () => {
  it("adds a supplier and explains a bad email", async () => {
    expect(await createSupplierAction(fresh, form({ name: "Crep Co", email: "sales@crep.test", phone: "", website: "", notes: "" }))).toEqual({ error: null, done: 1 });
    expect(inventory.suppliers.map((supplier) => supplier.name)).toEqual(["Crep Co"]);
    expect(await createSupplierAction(fresh, form({ name: "X", email: "nope", phone: "", website: "", notes: "" }))).toMatchObject({ error: "Enter a valid email address." });
  });
});

describe("removeInventoryImageAction", () => {
  it("treats an already-removed image as done", async () => {
    inventory.items.push({ id: "i1", name: "Laces", sku: "L", category: "Laces", stock: 4, lowStockAt: 5, active: true });
    expect(await removeInventoryImageAction("i1", "gone")).toEqual({ ok: true });
    expect(await removeInventoryImageAction("missing", "gone")).toEqual({ error: "This item no longer exists." });
  });
});
