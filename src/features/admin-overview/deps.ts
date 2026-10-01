import { PrismaOrderRepository } from "@/features/orders/repositories/prisma-order-repository";
import { prisma } from "@/shared/db/prisma-client";
import { redactForLog } from "@/shared/logging/redact";
import { getFileStorage, StorageNotConfiguredError, type FileStorage } from "@/shared/storage";
import type { AdminOverviewDeps } from "./get-admin-overview";

// The real (Prisma-backed) implementations behind getAdminOverview
// (ADR-0003/0011); the admin page imports this, never Prisma.
export function buildAdminOverviewDeps(): AdminOverviewDeps {
  // Built on first use and shared by every photo on the page.
  let storage: FileStorage | undefined;
  return {
    orders: new PrismaOrderRepository(prisma),
    photoUrl: async (key) => photoUrlOrNull(() => (storage ??= getFileStorage()), key),
    now: () => new Date(),
  };
}

/**
 * Photos are a nicety on the Overview: when a view link can't be made, the
 * table shows a placeholder instead of failing the page. Storage not being
 * configured (a local setup without S3) is expected and stays quiet; any
 * other failure, e.g. rotated S3 credentials, is logged.
 */
export async function photoUrlOrNull(storage: () => FileStorage, key: string): Promise<string | null> {
  try {
    return await storage().createViewUrl(key);
  } catch (err) {
    if (!(err instanceof StorageNotConfiguredError)) {
      console.error(`[admin-overview] photo view link failed: ${redactForLog(err instanceof Error ? err.message : String(err))}`);
    }
    return null;
  }
}
