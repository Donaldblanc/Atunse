// Edit Service / Edit Bundle's Save Changes: validates the side panel's
// fields and writes them in one update (the repository's whole-record
// write is naturally idempotent — saving the same values twice leaves the
// same row; no idempotency key needed — the form's `updatedAt` check below
// refuses a stale or replayed save instead). Admin-only (ADR-0012).

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import {
  ServiceNotFoundError,
  BundleNotFoundError,
  type BundleRecord,
  type BundleUpdate,
  type CatalogRepository,
  type ServiceCategory,
  type ServiceRecord,
  type ServiceUpdate,
} from "../repositories/catalog-repository";

export const SERVICE_NAME_MAX = 100;
export const DESCRIPTION_MAX = 500;
export const NOTES_MAX = 500;
export const SERVICE_CATEGORIES: ServiceCategory[] = ["CLEANING", "RESTORATION", "CUSTOM_WORK", "ADDITIONAL"];

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

export interface CatalogWriteDeps {
  catalog: Pick<CatalogRepository, "updateService" | "updateBundle">;
}

export interface UpdateServiceInput {
  serviceId: string;
  name: string;
  description: string;
  baseCents: number;
  suedeFeeCents: number;
  category: ServiceCategory;
  active: boolean;
  internalNotes: string | null;
  /** The `updatedAt` the form was rendered with; a mismatch means someone else saved first (CatalogChangedError). */
  expectedUpdatedAt: Date;
}

function validateMoney(cents: number, label: string): void {
  if (!Number.isInteger(cents) || cents < 0) throw new CatalogValidationError(`${label} must be a whole number of cents, zero or more.`);
}

export async function updateService(deps: CatalogWriteDeps, actingUser: ActingUser, input: UpdateServiceInput): Promise<ServiceRecord> {
  requireRole(actingUser, "ADMIN");

  const name = input.name.trim();
  const description = input.description.trim();
  if (!name || name.length > SERVICE_NAME_MAX) throw new CatalogValidationError(`Service name must be 1-${SERVICE_NAME_MAX} characters.`);
  if (!description || description.length > DESCRIPTION_MAX) throw new CatalogValidationError(`Description must be 1-${DESCRIPTION_MAX} characters.`);
  validateMoney(input.baseCents, "Base price");
  validateMoney(input.suedeFeeCents, "Suede upcharge");
  if (!SERVICE_CATEGORIES.includes(input.category)) throw new CatalogValidationError("Pick a valid category.");
  const internalNotes = input.internalNotes?.trim() || null;
  if (internalNotes && internalNotes.length > NOTES_MAX) throw new CatalogValidationError(`Notes must be at most ${NOTES_MAX} characters.`);

  const patch: ServiceUpdate = {
    name,
    description,
    baseCents: input.baseCents,
    suedeFeeCents: input.suedeFeeCents,
    category: input.category,
    active: input.active,
    internalNotes,
  };
  const updated = await deps.catalog.updateService(input.serviceId, patch, input.expectedUpdatedAt);
  if (!updated) throw new ServiceNotFoundError(input.serviceId);
  return updated;
}

export interface UpdateBundleInput {
  bundleId: string;
  name: string;
  priceCents: number;
  perks: string[];
  active: boolean;
  internalNotes: string | null;
  expectedUpdatedAt: Date;
}

export async function updateBundle(deps: CatalogWriteDeps, actingUser: ActingUser, input: UpdateBundleInput): Promise<BundleRecord> {
  requireRole(actingUser, "ADMIN");

  const name = input.name.trim();
  if (!name || name.length > SERVICE_NAME_MAX) throw new CatalogValidationError(`Bundle name must be 1-${SERVICE_NAME_MAX} characters.`);
  validateMoney(input.priceCents, "Price");
  const perks = input.perks.map((perk) => perk.trim()).filter(Boolean);
  const internalNotes = input.internalNotes?.trim() || null;
  if (internalNotes && internalNotes.length > NOTES_MAX) throw new CatalogValidationError(`Notes must be at most ${NOTES_MAX} characters.`);

  const patch: BundleUpdate = { name, priceCents: input.priceCents, perks, active: input.active, internalNotes };
  const updated = await deps.catalog.updateBundle(input.bundleId, patch, input.expectedUpdatedAt);
  if (!updated) throw new BundleNotFoundError(input.bundleId);
  return updated;
}
