import { PrismaAccountRepository } from "@/features/accounts/repositories/prisma-account-repository";
import { prisma } from "@/shared/db/prisma-client";
import { getFileStorage } from "@/shared/storage";
import { PrismaSettingsRepository } from "./repositories/prisma-settings-repository";

// The real (Prisma + FileStorage backed) implementations behind getSettings,
// saveSettings, requestLogoUpload and removeLogo (ADR-0003/0011); pages and
// actions import this, never Prisma.
export function buildSettingsDeps() {
  return {
    settings: new PrismaSettingsRepository(prisma),
    storage: getFileStorage(),
    accounts: new PrismaAccountRepository(prisma),
  };
}
