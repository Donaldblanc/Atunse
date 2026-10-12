// Edit Service/Bundle's Service Images: attaches an uploaded key, or
// removes one. Admin-only (ADR-0012). Adding the same key twice is refused
// by storage key uniqueness at the DB level (ServiceImage.key/BundleImage.key
// are @unique); removing an image that's already gone throws
// CatalogImageNotFoundError, which the caller reads as "already removed".

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { BundleNotFoundError, ServiceNotFoundError, type BundleRecord, type CatalogRepository, type ServiceRecord } from "../repositories/catalog-repository";

export interface CatalogImageDeps {
  catalog: Pick<CatalogRepository, "addServiceImage" | "removeServiceImage" | "addBundleImage" | "removeBundleImage">;
}

export async function addServiceImage(deps: CatalogImageDeps, actingUser: ActingUser, serviceId: string, key: string): Promise<ServiceRecord> {
  requireRole(actingUser, "ADMIN");
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
