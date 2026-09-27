// The server's source of truth for Service prices (CONTEXT.md: Service,
// Suede Fee, Rush, Deposit). The booking UI's display strings live in
// src/features/booking/services-data.ts; service-catalog.test.ts keeps the
// two in step. Pure — no React, no icons — so the use-case can import it.

import { Money } from "@/shared/money/money";

export interface CatalogService {
  id: string;
  name: string;
  /** Standard and Premium Clean. At most one per Item. */
  isCleaningTier: boolean;
  baseCents: number;
  /** True for "from $25+" prices: the real price depends on condition. */
  isMinimum: boolean;
  /** Carries the Suede Fee when the pair's material is Suede. */
  suedeFee: boolean;
}

export const SERVICE_CATALOG: CatalogService[] = [
  { id: "standard", name: "Standard Clean", isCleaningTier: true, baseCents: 3000, isMinimum: false, suedeFee: true },
  { id: "premium", name: "Premium Clean", isCleaningTier: true, baseCents: 5000, isMinimum: false, suedeFee: true },
  { id: "oxidation", name: "Oxidation Restoration", isCleaningTier: false, baseCents: 2500, isMinimum: true, suedeFee: false },
  { id: "painting", name: "Sneaker Painting & Dyeing", isCleaningTier: false, baseCents: 4000, isMinimum: true, suedeFee: false },
  { id: "reglue", name: "Reglue", isCleaningTier: false, baseCents: 5000, isMinimum: true, suedeFee: false },
];

export const MATERIALS = ["Leather", "Suede", "Canvas", "Knit / Mesh"] as const;
export type Material = (typeof MATERIALS)[number];

export const RUSH_FEE_CENTS = 2000;
export const SUEDE_FEE_CENTS = 1000;
/** CONTEXT.md: Deposit is 50% of the estimate. */
export const DEPOSIT_FRACTION = 0.5;

export class InvalidServiceSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidServiceSelectionError";
  }
}

export interface ItemEstimate {
  /** Services + Suede Fee for this pair. Rush is per Order, not per Item. */
  estimate: Money;
  isMinimum: boolean;
}

export function estimateItem(params: { serviceIds: string[]; material: Material | null }): ItemEstimate {
  const { serviceIds, material } = params;
  if (serviceIds.length === 0) {
    throw new InvalidServiceSelectionError("Select at least one service.");
  }
  if (new Set(serviceIds).size !== serviceIds.length) {
    throw new InvalidServiceSelectionError("A service can only be selected once.");
  }

  const services = serviceIds.map((id) => {
    const service = SERVICE_CATALOG.find((s) => s.id === id);
    if (!service) throw new InvalidServiceSelectionError(`Unknown service: ${id}`);
    return service;
  });
  if (services.filter((s) => s.isCleaningTier).length > 1) {
    throw new InvalidServiceSelectionError("Choose Standard or Premium Clean, not both.");
  }

  const suedeApplies = material === "Suede" && services.some((s) => s.suedeFee);
  const cents = services.reduce((sum, s) => sum + s.baseCents, 0) + (suedeApplies ? SUEDE_FEE_CENTS : 0);
  return { estimate: Money.fromCents(cents), isMinimum: services.some((s) => s.isMinimum) };
}

export interface OrderEstimate {
  estimate: Money;
  isMinimum: boolean;
  deposit: Money;
}

export function estimateOrder(params: { items: ItemEstimate[]; rush: boolean }): OrderEstimate {
  const itemsTotal = params.items.reduce((sum, item) => sum.add(item.estimate), Money.zero());
  const estimate = params.rush ? itemsTotal.add(Money.fromCents(RUSH_FEE_CENTS)) : itemsTotal;
  return {
    estimate,
    isMinimum: params.items.some((item) => item.isMinimum),
    deposit: estimate.percentage(DEPOSIT_FRACTION),
  };
}
