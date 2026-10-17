import { prisma } from "@/shared/db/prisma-client";
import { getFileStorage } from "@/shared/storage";
import { PrismaCatalogRepository } from "./repositories/prisma-catalog-repository";

// The real (Prisma + FileStorage backed) deps behind every Services &
// Pricing use-case (ADR-0003/0011); the admin page and its server actions
// import this, never Prisma.
export function buildCatalogDeps() {
  return {
    catalog: new PrismaCatalogRepository(prisma),
    /** Built on first use: it throws StorageNotConfiguredError when misconfigured. */
    get storage() {
      return getFileStorage();
    },
  };
}
