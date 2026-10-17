// "Delete Service"/"Delete Bundle" in the design map to deactivating, never
// a real delete: the Service schema comment is explicit that Services are
// "never deleted, since past Items name it" (same rule for Bundle/Order).
// Flipping Active off in the Edit panel does the same thing. A replay (the
// confirm dialog submitted twice) changes nothing further the second time.

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import { BundleNotFoundError, ServiceNotFoundError, type BundleRecord, type CatalogRepository, type ServiceRecord } from "../repositories/catalog-repository";

export interface CatalogActiveDeps {
  catalog: Pick<CatalogRepository, "getService" | "updateService" | "getBundle" | "updateBundle">;
}

export type SetActiveResult<T> = { status: "updated"; record: T } | { status: "unchanged"; record: T };

export async function setServiceActive(deps: CatalogActiveDeps, actingUser: ActingUser, serviceId: string, active: boolean): Promise<SetActiveResult<ServiceRecord>> {
  requireRole(actingUser, "ADMIN");

  const current = await deps.catalog.getService(serviceId);
  if (!current) throw new ServiceNotFoundError(serviceId);
  if (current.active === active) return { status: "unchanged", record: current };

  const updated = await deps.catalog.updateService(serviceId, { active });
  if (!updated) throw new ServiceNotFoundError(serviceId);
  return { status: "updated", record: updated };
}

export async function setBundleActive(deps: CatalogActiveDeps, actingUser: ActingUser, bundleId: string, active: boolean): Promise<SetActiveResult<BundleRecord>> {
  requireRole(actingUser, "ADMIN");

  const current = await deps.catalog.getBundle(bundleId);
  if (!current) throw new BundleNotFoundError(bundleId);
  if (current.active === active) return { status: "unchanged", record: current };

  const updated = await deps.catalog.updateBundle(bundleId, { active });
  if (!updated) throw new BundleNotFoundError(bundleId);
  return { status: "updated", record: updated };
}
