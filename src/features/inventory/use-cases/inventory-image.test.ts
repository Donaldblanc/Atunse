import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@/features/accounts/authz";
import { InMemoryFileStorage } from "@/shared/storage/in-memory-file-storage";
import { InMemoryInventoryRepository } from "../repositories/in-memory-inventory-repository";
import { InventoryImageKeyTakenError, InventoryImageNotFoundError, InventoryItemNotFoundError, TooManyInventoryImagesError } from "../repositories/inventory-repository";
import { MAX_PHOTO_BYTES } from "../inventory-image-keys";
import { addInventoryImage, removeInventoryImage } from "./inventory-image";
import { InventoryValidationError } from "./inventory-validation";
import { requestInventoryImageUpload } from "./request-inventory-image-upload";

const admin = { accountId: "admin-1", role: "ADMIN" as const };
const customer = { accountId: "c-1", role: "CUSTOMER" as const };

function setup() {
  const inventory = new InMemoryInventoryRepository([{ id: "a", name: "Cleaner", sku: null, category: "Cleaning", stock: 1, lowStockAt: 1, active: true }]);
  return { inventory, deps: { inventory } };
}

describe("addInventoryImage / removeInventoryImage", () => {
  it("attaches a key under the item's prefix and removes it", async () => {
    const { deps } = setup();
    const added = await addInventoryImage(deps, admin, "a", "inventory/a/one.jpg");
    expect(added.images).toHaveLength(1);
    expect((await removeInventoryImage(deps, admin, "a", added.images[0]!.id)).images).toHaveLength(0);
  });

  it("refuses keys outside the prefix, traversal, and duplicates", async () => {
    const { deps } = setup();
    await expect(addInventoryImage(deps, admin, "a", "services/a/one.jpg")).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(addInventoryImage(deps, admin, "a", "inventory/a/")).rejects.toBeInstanceOf(InventoryValidationError);
    await expect(addInventoryImage(deps, admin, "a", "inventory/a/../b/x.jpg")).rejects.toBeInstanceOf(InventoryValidationError);
    await addInventoryImage(deps, admin, "a", "inventory/a/one.jpg");
    await expect(addInventoryImage(deps, admin, "a", "inventory/a/one.jpg")).rejects.toBeInstanceOf(InventoryImageKeyTakenError);
  });

  it("caps at 5, and refuses missing items and images", async () => {
    const { deps } = setup();
    for (let i = 0; i < 5; i++) await addInventoryImage(deps, admin, "a", `inventory/a/${i}.jpg`);
    await expect(addInventoryImage(deps, admin, "a", "inventory/a/6.jpg")).rejects.toBeInstanceOf(TooManyInventoryImagesError);
    await expect(removeInventoryImage(deps, admin, "a", "nope")).rejects.toBeInstanceOf(InventoryImageNotFoundError);
    await expect(addInventoryImage(deps, admin, "zzz", "inventory/zzz/1.jpg")).rejects.toBeInstanceOf(InventoryItemNotFoundError);
  });

  it("is admin-only", async () => {
    const { deps } = setup();
    await expect(addInventoryImage(deps, customer, "a", "inventory/a/one.jpg")).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(removeInventoryImage(deps, customer, "a", "x")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("requestInventoryImageUpload", () => {
  it("issues a key under inventory/<id>/", async () => {
    const storage = new InMemoryFileStorage();
    const upload = await requestInventoryImageUpload({ storage }, admin, { itemId: "a", contentType: "image/jpeg", size: 100 });
    expect(upload.key).toMatch(/^inventory\/a\/[0-9a-f-]+\.jpg$/);
    expect(storage.issuedTargets).toHaveLength(1);
  });

  it("is admin-only", async () => {
    await expect(requestInventoryImageUpload({ storage: new InMemoryFileStorage() }, customer, { itemId: "a", contentType: "image/jpeg", size: 100 })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each([
    ["a bad item id", { itemId: "../x", contentType: "image/jpeg", size: 100 }],
    ["a non-image type", { itemId: "a", contentType: "application/pdf", size: 100 }],
    ["zero size", { itemId: "a", contentType: "image/jpeg", size: 0 }],
    ["an oversize file", { itemId: "a", contentType: "image/jpeg", size: MAX_PHOTO_BYTES + 1 }],
  ])("refuses %s without issuing a target", async (_label, input) => {
    const storage = new InMemoryFileStorage();
    await expect(requestInventoryImageUpload({ storage }, admin, input)).rejects.toBeInstanceOf(InventoryValidationError);
    expect(storage.issuedTargets).toHaveLength(0);
  });
});
