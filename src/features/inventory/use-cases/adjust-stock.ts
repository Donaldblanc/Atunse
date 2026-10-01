import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import {
  InventoryItemNotFoundError,
  NegativeStockError,
  StockChangedError,
  STOCK_ADJUST_REASONS,
  type InventoryRepository,
  type StockAdjustReason,
} from "../repositories/inventory-repository";

export const STOCK_NOTE_MAX_LENGTH = 500;
export const STOCK_CHANGE_LIMIT = 10_000;

export interface AdjustStockRequest {
  itemId: string;
  change: number;
  reason: string;
  note: string;
  seenStock: number;
}

export type AdjustStockResult = { ok: true; stock: number } | { ok: false; error: string };

/**
 * An admin restocks or corrects an Inventory Item. Admin-only (ADR-0012).
 * The repository updates stock only if it is still what the admin saw and
 * writes the StockMovement in the same transaction, so a replay or a stale
 * tab is refused rather than applied twice. Problems come back as messages.
 */
export async function adjustStock(
  deps: { inventory: Pick<InventoryRepository, "adjustStock"> },
  actingUser: ActingUser,
  input: AdjustStockRequest,
): Promise<AdjustStockResult> {
  requireRole(actingUser, "ADMIN");
  if (!Number.isInteger(input.change) || input.change === 0) return { ok: false, error: "Enter a whole number other than 0." };
  if (Math.abs(input.change) > STOCK_CHANGE_LIMIT) return { ok: false, error: `Keep the change within ${STOCK_CHANGE_LIMIT.toLocaleString("en-US")}.` };
  if (!(STOCK_ADJUST_REASONS as readonly string[]).includes(input.reason)) return { ok: false, error: "Choose a reason." };
  if (!Number.isInteger(input.seenStock) || input.seenStock < 0) return { ok: false, error: "That request wasn't valid. Reload and try again." };
  const note = input.note.trim();
  if (note.length > STOCK_NOTE_MAX_LENGTH) return { ok: false, error: `Keep the note under ${STOCK_NOTE_MAX_LENGTH} characters.` };

  try {
    const { stock } = await deps.inventory.adjustStock({
      itemId: input.itemId,
      change: input.change,
      reason: input.reason as StockAdjustReason,
      note: note || null,
      seenStock: input.seenStock,
      actorAccountId: actingUser.accountId,
    });
    return { ok: true, stock };
  } catch (err) {
    if (err instanceof InventoryItemNotFoundError) return { ok: false, error: "This item no longer exists." };
    if (err instanceof StockChangedError) return { ok: false, error: `Stock changed to ${err.currentStock} since you opened this. Check the new figure and try again.` };
    if (err instanceof NegativeStockError) return { ok: false, error: `Stock can't go below 0 (it is ${err.currentStock} now).` };
    throw err;
  }
}
