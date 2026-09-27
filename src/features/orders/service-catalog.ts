// The one source of truth for Service prices (CONTEXT.md: Service, Suede
// Fee, Rush, Deposit): the server computes estimates from it, and every
// price the site shows (booking flow, Services page) is formatted from it
// by the helpers at the bottom. Pure — no React, no icons — so the
// use-case can import it.

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
  /** What a minimum price covers when the Service prices parts separately, e.g. "Midsole". */
  minimumLabel?: string;
  /** Other published "from" prices for parts of the Service (display only; the estimate uses baseCents). */
  alsoFrom?: { label: string; cents: number }[];
}

export const SERVICE_CATALOG: CatalogService[] = [
  { id: "standard", name: "Standard Clean", isCleaningTier: true, baseCents: 3000, isMinimum: false, suedeFee: true },
  { id: "premium", name: "Premium Clean", isCleaningTier: true, baseCents: 5000, isMinimum: false, suedeFee: true },
  {
    id: "oxidation",
    name: "Oxidation Restoration",
    isCleaningTier: false,
    baseCents: 2500,
    isMinimum: true,
    suedeFee: false,
    minimumLabel: "Midsole",
    alsoFrom: [{ label: "Sole", cents: 4000 }],
  },
  { id: "painting", name: "Sneaker Painting & Dyeing", isCleaningTier: false, baseCents: 4000, isMinimum: true, suedeFee: false },
  { id: "reglue", name: "Reglue", isCleaningTier: false, baseCents: 5000, isMinimum: true, suedeFee: false },
];

/**
 * CONTEXT.md: Bundle. A fixed-price package covering three pairs, each its
 * own Item. Every pair gets BUNDLE_PAIR_SERVICE_IDS; the perks that cover
 * only some pairs ("Oxidation touch-up on 1 pair") are assigned by the shop
 * after inspection, so the Order records which Bundle was bought.
 */
export interface CatalogBundle {
  id: string;
  name: string;
  priceCents: number;
  perks: string[];
}

export const BUNDLE_PAIRS = 3;

/** Premium Clean on every pair: the one perk each Bundle gives all three pairs. */
export const BUNDLE_PAIR_SERVICE_IDS = ["premium"];

export const BUNDLE_CATALOG: CatalogBundle[] = [
  {
    id: "revival",
    name: "The Revival Pack",
    priceCents: 15000,
    perks: ["Premium Clean (all 3 pairs)", "Suede fee waived", "Priority turnaround", "Oxidation touch-up on 1 pair"],
  },
  {
    id: "restoration",
    name: "The Restoration Trio",
    priceCents: 17500,
    perks: [
      "Premium Clean (all 3 pairs)",
      "Suede fee waived",
      "Deep sole whitening (all pairs)",
      "Oxidation midsole on 1 pair",
    ],
  },
  {
    id: "collector",
    name: "The Collector’s Triple",
    priceCents: 20000,
    perks: [
      "Premium Clean (all 3 pairs)",
      "Suede fee waived",
      "Oxidation midsole (2 pairs)",
      "Reglue inspection",
      "Paint/dye touch-up on 1 pair",
      "VIP turnaround (48–72 hours)",
    ],
  },
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

export function catalogBundle(id: string): CatalogBundle {
  const bundle = BUNDLE_CATALOG.find((b) => b.id === id);
  if (!bundle) throw new InvalidServiceSelectionError(`Unknown bundle: ${id}`);
  return bundle;
}

/**
 * Each pair's share of a Bundle's fixed price. Split evenly, with leftover
 * cents on the first pairs, so the Items always sum to exactly the Bundle
 * price (CONTEXT.md: the Deposit is 50% of the sum of the Items). Flat, and
 * the Suede Fee is waived whatever the material.
 */
export function estimateBundleItems(bundleId: string): ItemEstimate[] {
  const { priceCents } = catalogBundle(bundleId);
  const share = Math.floor(priceCents / BUNDLE_PAIRS);
  const leftover = priceCents - share * BUNDLE_PAIRS;
  return Array.from({ length: BUNDLE_PAIRS }, (_, i) => ({
    estimate: Money.fromCents(share + (i < leftover ? 1 : 0)),
    isMinimum: false,
  }));
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

// ---- Display: every price string the site shows is formatted here ----

export function catalogService(id: string): CatalogService {
  const service = SERVICE_CATALOG.find((s) => s.id === id);
  if (!service) throw new InvalidServiceSelectionError(`Unknown service: ${id}`);
  return service;
}

/** A price as the site shows it: "$30" when flat, "$25+" when it's a minimum. */
export function formatPrice(cents: number, isMinimum: boolean): string {
  return `${Money.fromCents(cents).format()}${isMinimum ? "+" : ""}`;
}

/** A Service's headline price: "$30", "Starting at $40+", "Midsole from $25+". */
export function formatServicePrice(service: CatalogService): string {
  if (!service.isMinimum) return formatPrice(service.baseCents, false);
  const lead = service.minimumLabel ? `${service.minimumLabel} from` : "Starting at";
  return `${lead} ${formatPrice(service.baseCents, true)}`;
}

/** A Service's other published "from" prices, e.g. ["Sole from $40+"]. */
export function alsoFromNotes(service: CatalogService): string[] {
  return (service.alsoFrom ?? []).map((part) => `${part.label} from ${formatPrice(part.cents, true)}`);
}

/** Secondary price lines for a Service, e.g. ["+$10 for Suede"] or ["Sole from $40+"]. */
export function serviceNotes(service: CatalogService): string[] {
  return [...alsoFromNotes(service), ...(service.suedeFee ? [suedeFeeNote(false)] : [])];
}

export function suedeFeeNote(applied: boolean): string {
  const fee = Money.fromCents(SUEDE_FEE_CENTS).format();
  return applied ? `Includes +${fee} Suede fee` : `+${fee} for Suede`;
}

export function rushFeeNote(): string {
  return `+${Money.fromCents(RUSH_FEE_CENTS).format()} rush`;
}
