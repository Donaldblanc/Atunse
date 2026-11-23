import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { InventoryRepository, NewSupplierInput, SupplierRecord } from "../repositories/inventory-repository";
import { InventoryValidationError } from "./inventory-validation";

export const SUPPLIER_NAME_MAX = 100;
export const SUPPLIER_CONTACT_MAX = 200;
export const SUPPLIER_NOTES_MAX = 500;

export async function listSuppliers(deps: { inventory: Pick<InventoryRepository, "listSuppliers"> }, actingUser: ActingUser): Promise<SupplierRecord[]> {
  requireRole(actingUser, "ADMIN");
  return deps.inventory.listSuppliers();
}

export interface CreateSupplierRequest {
  name: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
}

export async function createSupplier(
  deps: { inventory: Pick<InventoryRepository, "createSupplier"> },
  actingUser: ActingUser,
  input: CreateSupplierRequest,
): Promise<SupplierRecord> {
  requireRole(actingUser, "ADMIN");
  const name = input.name.trim();
  if (!name || name.length > SUPPLIER_NAME_MAX) throw new InventoryValidationError(`Supplier name must be 1-${SUPPLIER_NAME_MAX} characters.`);
  const email = input.email.trim();
  if (email && (email.length > SUPPLIER_CONTACT_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new InventoryValidationError("Enter a valid email address.");
  const phone = input.phone.trim();
  if (phone.length > SUPPLIER_CONTACT_MAX) throw new InventoryValidationError(`Phone must be at most ${SUPPLIER_CONTACT_MAX} characters.`);
  const website = input.website.trim();
  if (website.length > SUPPLIER_CONTACT_MAX) throw new InventoryValidationError(`Website must be at most ${SUPPLIER_CONTACT_MAX} characters.`);
  const notes = input.notes.trim();
  if (notes.length > SUPPLIER_NOTES_MAX) throw new InventoryValidationError(`Notes must be at most ${SUPPLIER_NOTES_MAX} characters.`);
  const record: NewSupplierInput = { name, email: email || null, phone: phone || null, website: website || null, notes: notes || null };
  return deps.inventory.createSupplier(record);
}
