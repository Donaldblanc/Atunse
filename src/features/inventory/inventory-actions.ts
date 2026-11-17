"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { requireRole } from "@/features/accounts/authz";
import { buildInventoryDeps } from "./deps";
import { expectedUpdatedAt, ID_PATTERN, inventoryErrorMessage, NOT_VALID, parseItemRequest, text, wholeNumber, type InventoryFormState } from "./inventory-form";
import { InventoryImageNotFoundError } from "./repositories/inventory-repository";
import { adjustStock } from "./use-cases/adjust-stock";
import { addInventoryImage, removeInventoryImage } from "./use-cases/inventory-image";
import { requestInventoryImageUpload, type InventoryImageUpload } from "./use-cases/request-inventory-image-upload";
import { createInventoryItem, setInventoryItemActive, updateInventoryItem } from "./use-cases/save-inventory-item";
import { createSupplier } from "./use-cases/suppliers";

// The Inventory screen's writes. Each action checks the admin role before it
// reads anything (ADR-0012) and turns the use-cases' named errors into
// messages; the screen shows them next to the form.

/** Only ever back to an /admin URL. */
function returnToAdmin(formData: FormData, fallback: string): string {
  const returnTo = text(formData, "returnTo");
  return returnTo.startsWith("/admin/") ? returnTo : fallback;
}

async function adminUser() {
  const actingUser = await actingUserFromCookies(await cookies());
  requireRole(actingUser, "ADMIN");
  return actingUser;
}

/** Add Item's Add button: creates the item and opens its panel. */
export async function createInventoryItemAction(previous: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  if (!text(formData, "idempotencyKey")) return { ...previous, error: NOT_VALID };
  const parsed = parseItemRequest(formData, true);
  if ("error" in parsed) return { ...previous, error: parsed.error };

  let itemId: string;
  try {
    const actingUser = await adminUser();
    const created = await createInventoryItem(buildInventoryDeps(), actingUser, { ...parsed.request, initialStock: wholeNumber(text(formData, "initialStock") || "0") });
    itemId = created.id;
  } catch (err) {
    const message = inventoryErrorMessage(err);
    if (message) return { ...previous, error: message };
    throw err;
  }

  revalidatePath("/admin/inventory");
  // New stock may be below its own alert level, which the Overview counts.
  revalidatePath("/admin");
  redirect(`/admin/inventory?item=${itemId}`);
}

/** The Details form's Save Changes. Never changes stock. */
export async function updateInventoryItemAction(previous: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const itemId = text(formData, "itemId");
  if (!ID_PATTERN.test(itemId)) return { ...previous, error: NOT_VALID };
  const expected = expectedUpdatedAt(formData);
  if (!expected) return { ...previous, error: "This was changed elsewhere. Reload and try again." };
  const parsed = parseItemRequest(formData, text(formData, "active") === "true");
  if ("error" in parsed) return { ...previous, error: parsed.error };

  try {
    const actingUser = await adminUser();
    await updateInventoryItem(buildInventoryDeps(), actingUser, { ...parsed.request, itemId, expectedUpdatedAt: expected });
  } catch (err) {
    const message = inventoryErrorMessage(err);
    if (message) return { ...previous, error: message };
    throw err;
  }

  revalidatePath("/admin/inventory");
  // The alert level can move an item in or out of the Overview's Low Stock.
  revalidatePath("/admin");
  return { error: null, done: previous.done + 1 };
}

/** Deactivate (the design's "Delete Item"; items are never deleted) or Reactivate. */
export async function setInventoryItemActiveAction(previous: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const itemId = text(formData, "itemId");
  if (!ID_PATTERN.test(itemId)) return { ...previous, error: NOT_VALID };
  const active = text(formData, "active") === "true";

  try {
    const actingUser = await adminUser();
    await setInventoryItemActive(buildInventoryDeps(), actingUser, itemId, active);
  } catch (err) {
    const message = inventoryErrorMessage(err);
    if (message) return { ...previous, error: message };
    throw err;
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  redirect(returnToAdmin(formData, "/admin/inventory"));
}

/** The panel's Adjust stock. `seenStock` is the stock on screen, so a replay or a stale tab is refused. */
export async function adjustInventoryStockAction(previous: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const actingUser = await adminUser();
  const itemId = text(formData, "itemId");
  const seenStock = wholeNumber(text(formData, "seenStock"));
  if (!ID_PATTERN.test(itemId) || !text(formData, "idempotencyKey") || Number.isNaN(seenStock)) return { ...previous, error: NOT_VALID };
  const change = wholeNumber(text(formData, "change"));
  if (Number.isNaN(change)) return { ...previous, error: "Enter a whole number other than 0." };

  const result = await adjustStock(buildInventoryDeps(), actingUser, { itemId, change, reason: text(formData, "reason"), note: text(formData, "note"), seenStock });
  // Revalidate on a refusal too: a stale-stock error needs the panel re-rendered with the new figure.
  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  if (!result.ok) return { ...previous, error: result.error };
  return { error: null, done: previous.done + 1 };
}

/** The Supplier tab's Add supplier. */
export async function createSupplierAction(previous: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  try {
    const actingUser = await adminUser();
    await createSupplier(buildInventoryDeps(), actingUser, {
      name: text(formData, "name"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      website: text(formData, "website"),
      notes: text(formData, "notes"),
    });
  } catch (err) {
    const message = inventoryErrorMessage(err);
    if (message) return { ...previous, error: message };
    throw err;
  }
  revalidatePath("/admin/inventory");
  return { error: null, done: previous.done + 1 };
}

export type InventoryImageUploadResult = { upload: InventoryImageUpload } | { error: string };
export type InventoryImageActionResult = { ok: true } | { error: string };

/** Add Image: a presigned upload target (ADR-0004). Called from the uploader's client code, not a form. */
export async function requestInventoryImageUploadAction(itemId: string, contentType: string, size: number): Promise<InventoryImageUploadResult> {
  try {
    const actingUser = await adminUser();
    return { upload: await requestInventoryImageUpload(buildInventoryDeps(), actingUser, { itemId, contentType, size }) };
  } catch (err) {
    const message = inventoryErrorMessage(err);
    if (message) return { error: message };
    throw err;
  }
}

/** Records an uploaded key against the item, once the browser's presigned upload finished. */
export async function addInventoryImageAction(itemId: string, key: string): Promise<InventoryImageActionResult> {
  try {
    const actingUser = await adminUser();
    await addInventoryImage(buildInventoryDeps(), actingUser, itemId, key);
  } catch (err) {
    const message = inventoryErrorMessage(err);
    if (message) return { error: message };
    throw err;
  }
  revalidatePath("/admin/inventory");
  return { ok: true };
}

export async function removeInventoryImageAction(itemId: string, imageId: string): Promise<InventoryImageActionResult> {
  try {
    const actingUser = await adminUser();
    await removeInventoryImage(buildInventoryDeps(), actingUser, itemId, imageId);
  } catch (err) {
    if (err instanceof InventoryImageNotFoundError) return { ok: true }; // already removed
    const message = inventoryErrorMessage(err);
    if (message) return { error: message };
    throw err;
  }
  revalidatePath("/admin/inventory");
  return { ok: true };
}
