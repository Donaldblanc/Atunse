"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { UnauthorizedError } from "@/features/accounts/authz";
import { buildOrderUseCaseDeps } from "@/features/orders/deps";
import { PAIR_DETAIL_FIELDS } from "@/features/orders/order-details";
import { ItemNotFoundError, OrderChangedError, OrderNotFoundError } from "@/features/orders/repositories/order-repository";
import { addOrderNote } from "@/features/orders/use-cases/add-order-note";
import { updateOrderDetails, type OrderDetailsErrors, type RawOrderDetails } from "@/features/orders/use-cases/update-order-details";

export type EditOrderState = {
  /** A problem with the save as a whole (stale form, signed out); field problems are in `errors`. */
  error: string | null;
  errors: OrderDetailsErrors;
  saved: boolean;
};

export type AddNoteState = { error: string | null; /** Bumped on each success so the form can clear itself. */ added: number };

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * Edit Order's Save: contact, address and every pair's details in one
 * transaction (updateOrderDetails). The admin role is checked before
 * anything is read (ADR-0012). `updatedAt` is the Order's stamp when the form
 * rendered, so a form left open in another tab can't overwrite a newer edit.
 * Nothing here logs form values: they're customer contact details.
 */
export async function updateOrderDetailsAction(_previous: EditOrderState, formData: FormData): Promise<EditOrderState> {
  const orderId = text(formData, "orderId");
  const idempotencyKey = text(formData, "idempotencyKey");
  const expectedUpdatedAt = new Date(text(formData, "updatedAt"));
  const itemIds = formData.getAll("itemId").filter((id): id is string => typeof id === "string");
  if (!orderId || !idempotencyKey || Number.isNaN(expectedUpdatedAt.getTime())) {
    return { error: "That request wasn't valid. Reload and try again.", errors: {}, saved: false };
  }

  const raw: RawOrderDetails = {
    contactName: text(formData, "contactName"),
    contactEmail: text(formData, "contactEmail"),
    contactPhone: text(formData, "contactPhone"),
    line1: text(formData, "line1"),
    line2: text(formData, "line2"),
    city: text(formData, "city"),
    state: text(formData, "state"),
    zip: text(formData, "zip"),
    pairs: itemIds.map((itemId) => ({
      itemId,
      ...(Object.fromEntries(PAIR_DETAIL_FIELDS.map((field) => [field, text(formData, `${itemId}:${field}`)])) as Record<(typeof PAIR_DETAIL_FIELDS)[number], string>),
    })),
  };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const result = await updateOrderDetails(buildOrderUseCaseDeps(), actingUser, { orderId, expectedUpdatedAt, raw, idempotencyKey });
    if (!result.ok) return { error: null, errors: result.errors, saved: false };
  } catch (err) {
    if (err instanceof OrderChangedError) return { error: "This order changed since you opened it. Reload the page to see the latest, then edit again.", errors: {}, saved: false };
    if (err instanceof OrderNotFoundError || err instanceof ItemNotFoundError) return { error: "This order or one of its pairs no longer exists.", errors: {}, saved: false };
    if (err instanceof UnauthorizedError) return { error: "You need to be signed in as an admin to do that.", errors: {}, saved: false };
    throw err;
  }

  revalidatePath("/admin");
  return { error: null, errors: {}, saved: true };
}

/** Order detail's Add note: appends an admin-only Note to the Order. */
export async function addOrderNoteAction(previous: AddNoteState, formData: FormData): Promise<AddNoteState> {
  const orderId = text(formData, "orderId");
  if (!orderId) return { ...previous, error: "That request wasn't valid. Reload and try again." };

  try {
    const actingUser = await actingUserFromCookies(await cookies());
    const result = await addOrderNote(buildOrderUseCaseDeps(), actingUser, { orderId, body: text(formData, "body") });
    if (!result.ok) return { ...previous, error: result.error };
  } catch (err) {
    if (err instanceof OrderNotFoundError) return { ...previous, error: "This order no longer exists." };
    if (err instanceof UnauthorizedError) return { ...previous, error: "You need to be signed in as an admin to do that." };
    throw err;
  }

  revalidatePath("/admin");
  return { error: null, added: previous.added + 1 };
}
