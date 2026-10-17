// Edit Service/Bundle's Service Images: attaches an uploaded key, or
// removes one. Admin-only (ADR-0012). Adding the same key twice is refused
// as CatalogImageKeyTakenError (ServiceImage.key/BundleImage.key are
// @unique); keys must sit under the item's own `services/<id>/` or `bundles/<id>/` prefix; removing an image that's already gone throws
// CatalogImageNotFoundError, which the caller reads as "already removed".

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { CatalogValidationError } from "./update-catalog-item";
import { BundleNotFoundError, ServiceNotFoundError, type BundleRecord, type CatalogRepository, type ServiceRecord } from "../repositories/catalog-repository";

/** Only keys the presign step issued for this Service/Bundle (`catalog-image-keys.ts`) may be attached. */
function requireKeyUnder(prefix: string, key: string): void {
  if (!key.startsWith(prefix) || key.length === prefix.length || key.includes("..")) throw new CatalogValidationError("That image wasn't uploaded for this item.");
}

export interface CatalogImageDeps {
  catalog: Pick<CatalogRepository, "addServiceImage" | "removeServiceImage" | "addBundleImage" | "removeBundleImage">;
}

export async function addServiceImage(deps: CatalogImageDeps, actingUser: ActingUser, serviceId: string, key: string): Promise<ServiceRecord> {
  requireRole(actingUser, "ADMIN");
  requireKeyUnder(`services/${serviceId}/`, key);
  const updated = await deps.catalog.addServiceImage(serviceId, key);
  if (!updated) throw new ServiceNotFoundError(serviceId);
  return updated;
}

export async function removeServiceImage(deps: CatalogImageDeps, actingUser: ActingUser, serviceId: string, imageId: string): Promise<ServiceRecord> {
  requireRole(actingUser, "ADMIN");
  const updated = await deps.catalog.removeServiceImage(serviceId, imageId);
  if (!updated) throw new ServiceNotFoundError(serviceId);
  return updated;
}

export async function addBundleImage(deps: CatalogImageDeps, actingUser: ActingUser, bundleId: string, key: string): Promise<BundleRecord> {
  requireRole(actingUser, "ADMIN");
  requireKeyUnder(`bundles/${bundleId}/`, key);
  const updated = await deps.catalog.addBundleImage(bundleId, key);
  if (!updated) throw new BundleNotFoundError(bundleId);
  return updated;
}

export async function removeBundleImage(deps: CatalogImageDeps, actingUser: ActingUser, bundleId: string, imageId: string): Promise<BundleRecord> {
  requireRole(actingUser, "ADMIN");
  const updated = await deps.catalog.removeBundleImage(bundleId, imageId);
  if (!updated) throw new BundleNotFoundError(bundleId);
  return updated;
}
