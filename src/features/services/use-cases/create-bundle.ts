// Bundles tab's Add Bundle: a new Bundle row, active by default, placed
// last. Admin-only (ADR-0012).

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { BundleIdTakenError, type BundleRecord, type CatalogRepository } from "../repositories/catalog-repository";
import { CatalogValidationError, NOTES_MAX, SERVICE_NAME_MAX } from "./update-catalog-item";

export interface CreateBundleDeps {
  catalog: Pick<CatalogRepository, "getBundle" | "createBundle" | "listBundles">;
}

export interface CreateBundleInput {
  name: string;
  priceCents: number;
  perks: string[];
  internalNotes?: string | null;
}

/** "the-revival-pack" from "The Revival Pack", so ids stay URL-safe and readable in the DB. */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createBundle(deps: CreateBundleDeps, actingUser: ActingUser, input: CreateBundleInput): Promise<BundleRecord> {
  requireRole(actingUser, "ADMIN");

  const name = input.name.trim();
  if (!name || name.length > SERVICE_NAME_MAX) throw new CatalogValidationError(`Bundle name must be 1-${SERVICE_NAME_MAX} characters.`);
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) throw new CatalogValidationError("Price must be a whole number of cents, zero or more.");
  const internalNotes = input.internalNotes?.trim() || null;
  if (internalNotes && internalNotes.length > NOTES_MAX) throw new CatalogValidationError(`Notes must be at most ${NOTES_MAX} characters.`);

  const id = slugify(name);
  if (!id) throw new CatalogValidationError("Bundle name must contain at least one letter or number.");
  if (await deps.catalog.getBundle(id)) throw new BundleIdTakenError(id);

  const existing = await deps.catalog.listBundles();
  const position = existing.reduce((max, bundle) => Math.max(max, bundle.position), -1) + 1;

  return deps.catalog.createBundle({
    id,
    name,
    priceCents: input.priceCents,
    perks: input.perks.map((perk) => perk.trim()).filter(Boolean),
    internalNotes,
    position,
  });
}
