import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryInventoryRepository } from "../repositories/in-memory-inventory-repository";
import { InventoryValidationError } from "./inventory-validation";
import { createSupplier, listSuppliers } from "./suppliers";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };
const request = { name: " Acme ", email: "", phone: "", website: "", notes: "" };

describe("suppliers", () => {
  it("creates with blanks as null and lists by name", async () => {
    const deps = { inventory: new InMemoryInventoryRepository() };
    await createSupplier(deps, admin, { ...request, name: "Zed" });
    expect(await createSupplier(deps, admin, { ...request, email: "a@acme.co" })).toMatchObject({ name: "Acme", email: "a@acme.co", phone: null });
    expect((await listSuppliers(deps, admin)).map((s) => s.name)).toEqual(["Acme", "Zed"]);
  });

  it.each([
    ["a blank name", { name: " " }],
    ["a long name", { name: "x".repeat(101) }],
    ["a bad email", { email: "nope" }],
    ["long notes", { notes: "x".repeat(501) }],
  ])("refuses %s", async (_label, over) => {
    const deps = { inventory: new InMemoryInventoryRepository() };
    await expect(createSupplier(deps, admin, { ...request, ...over })).rejects.toBeInstanceOf(InventoryValidationError);
    expect(deps.inventory.suppliers).toHaveLength(0);
  });

  it("is admin-only", async () => {
    const deps = { inventory: new InMemoryInventoryRepository() };
    await expect(createSupplier(deps, customer, request)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(listSuppliers(deps, customer)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
