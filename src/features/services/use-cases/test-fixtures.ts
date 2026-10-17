import type { ActingUser } from "@/features/accounts/authz";
import type { BundleRecord, ServiceRecord } from "../repositories/catalog-repository";

export const ADMIN: ActingUser = { accountId: "acc_admin", role: "ADMIN" };
export const CUSTOMER: ActingUser = { accountId: "acc_cust", role: "CUSTOMER" };

export function makeService(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: "standard",
    name: "Standard Clean",
    description: "Deep clean, sanitize, and refresh.",
    category: "CLEANING",
    isCleaningTier: true,
    isAddOn: false,
    baseCents: 3000,
    isMinimum: false,
    suedeFeeCents: 1000,
    minimumLabel: null,
    internalNotes: null,
    active: true,
    position: 0,
    images: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeBundle(overrides: Partial<BundleRecord> = {}): BundleRecord {
  return {
    id: "revival",
    name: "The Revival Pack",
    priceCents: 15000,
    perks: ["Premium Clean (all 3)", "Suede fee waived"],
    internalNotes: null,
    active: true,
    position: 0,
    images: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}
