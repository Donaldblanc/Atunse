// Services & Pricing's All Services / Bundles tabs: every Service and
// Bundle, catalog order. Admin-only (ADR-0012); never imports Prisma
// (ADR-0003/0011).

import type { ActingUser } from "@/features/accounts/authz";
import { requireRole } from "@/features/accounts/authz";
import type { BundleRecord, CatalogRepository, ServiceRecord } from "../repositories/catalog-repository";

export interface CatalogListDeps {
  catalog: Pick<CatalogRepository, "listServices" | "listBundles">;
}

export interface Catalog {
  services: ServiceRecord[];
  bundles: BundleRecord[];
}

export async function listCatalog(deps: CatalogListDeps, actingUser: ActingUser): Promise<Catalog> {
  requireRole(actingUser, "ADMIN");

  const [services, bundles] = await Promise.all([deps.catalog.listServices(), deps.catalog.listBundles()]);
  return { services, bundles };
}
