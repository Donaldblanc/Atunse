// Service prices as data (CONTEXT.md: Service, Add-on, Suede Fee, Rush,
// Deposit): a Catalog is loaded from the services/bundles tables
// (features/services/site-catalog.ts) and handed to these pure functions.
// The server computes estimates from it, and every price the site shows
// (booking flow, Services page) is formatted from it by the helpers at the
// bottom. Pure — no React, no icons — so the use-case can import it.

import { Money } from "@/shared/money/money";

/** ADR-0017: only "restoration" and "custom-work" Services require a Quote. */
export type ServiceCategory = "cleaning" | "restoration" | "custom-work" | "additional";

export interface CatalogService {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  /** Off the site and refused for new bookings; past Items still name it. */
  active: boolean;
  /** Standard and Premium Clean. At most one per Item. */
  isCleaningTier: boolean;
  /**
   * An optional extra on top of a pair's main Service (CONTEXT.md: Add-on):
   * never booked alone, and chosen per pair, Bundle pairs included.
   */
  isAddOn: boolean;
  baseCents: number;
  /** True for "from $25+" prices: the real price depends on condition. */
  isMinimum: boolean;
  /** The Suede Fee this Service carries on a Suede pair; 0 = none. */
  suedeFeeCents: number;
  /** What a minimum price covers when the Service prices parts separately, e.g. "Midsole". */
  minimumLabel?: string;
  /** Other published "from" prices for parts of the Service (display only; the estimate uses baseCents). */
  alsoFrom?: { label: string; cents: number }[];
}

/** The Services and Bundles the site and booking read, in display order. */
export interface Catalog {
  services: CatalogService[];
  bundles: CatalogBundle[];
}

/** The Add-ons, in the order the booking flow offers them. */
export function addOnServices(catalog: Catalog): CatalogService[] {
  return catalog.services.filter((s) => s.isAddOn);
}

/**
 * CONTEXT.md: Bundle. A fixed-price package covering three pairs, each its
 * own Item. Every pair gets the Bundle's pairServiceIds (Premium Clean
 * unless the shop sets others); the perks that cover
 * only some pairs ("Oxidation touch-up on 1 pair") are assigned by the shop
 * after inspection, so the Order records which Bundle was bought.
 */
export interface CatalogBundle {
  id: string;
  name: string;
  priceCents: number;
  perks: string[];
  /** Off the site and refused for new bookings; past Orders still name it. */
  active: boolean;
  /** The Services every pair gets. */
  pairServiceIds: string[];
  /** A promotion's last instant (ISO, exclusive): it can't be booked at or after it. Absent for always-on Bundles. */
  endsAt?: string;
}

/** Where a use-case gets the Catalog: loadCatalog() in the app, DEFAULT_CATALOG in tests. */
export interface CatalogSource {
  load(): Promise<Catalog>;
}

export const BUNDLE_PAIRS = 3;

export const MATERIALS = ["Leather", "Suede", "Canvas", "Knit / Mesh"] as const;
export type Material = (typeof MATERIALS)[number];

export const RUSH_FEE_CENTS = 2000;
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

/** Catalog Services for these ids: each known, each at most once. */
function lookUpServices(catalog: Catalog, serviceIds: string[]): CatalogService[] {
  if (new Set(serviceIds).size !== serviceIds.length) {
    throw new InvalidServiceSelectionError("A service can only be selected once.");
  }
  return serviceIds.map((id) => {
    const service = findService(catalog, id);
    if (!service) throw new InvalidServiceSelectionError(`Unknown service: ${id}`);
    return service;
  });
}

/** The Service with this id, active or not (past Items name inactive ones), or null. */
export function findService(catalog: Catalog, id: string): CatalogService | null {
  return catalog.services.find((s) => s.id === id) ?? null;
}

/** A Service's name for display on an existing Order: the raw id if the catalog no longer has it. */
export function serviceName(catalog: Catalog, id: string): string {
  return findService(catalog, id)?.name ?? id;
}

/** A Bundle's name for display on an existing Order: the raw id if the catalog no longer has it. */
export function bundleName(catalog: Catalog, id: string): string {
  return findBundle(catalog, id)?.name ?? id;
}

/** New bookings only: refuses a Service the shop has switched off. */
export function assertServicesBookable(catalog: Catalog, serviceIds: string[]): void {
  for (const service of lookUpServices(catalog, serviceIds)) {
    if (!service.active) throw new InvalidServiceSelectionError(`${service.name} isn't available any more.`);
  }
}

/** New bookings only: refuses an inactive or ended Bundle. */
export function assertBundleBookable(catalog: Catalog, bundleId: string, now: Date): CatalogBundle {
  const bundle = catalogBundle(catalog, bundleId);
  if (!bundle.active) throw new InvalidServiceSelectionError(`${bundle.name} isn't available any more.`);
  if (!isBundleAvailable(bundle, now)) throw new InvalidServiceSelectionError("This promotion has ended.");
  return bundle;
}

/** The price of a pair's Add-ons; rejects anything that isn't one. */
export function addOnsCents(catalog: Catalog, addOnIds: string[]): number {
  const addOns = lookUpServices(catalog, addOnIds);
  const notAddOn = addOns.find((s) => !s.isAddOn);
  if (notAddOn) throw new InvalidServiceSelectionError("A Bundle's Services come with it: only add-ons can be chosen per pair.");
  return addOns.reduce((sum, s) => sum + s.baseCents, 0);
}

/**
 * The Suede Fee for a pair: the largest fee among its Services, charged once,
 * and only when the material is Suede. 0 when none applies.
 */
export function suedeFeeCents(material: string | null, services: CatalogService[]): number {
  return material === "Suede" ? Math.max(0, ...services.map((s) => s.suedeFeeCents)) : 0;
}

/** True when the Suede Fee is charged: a Suede pair with a Service that carries it. */
export function suedeFeeApplies(material: string | null, services: CatalogService[]): boolean {
  return suedeFeeCents(material, services) > 0;
}

export function estimateItem(catalog: Catalog, params: { serviceIds: string[]; material: Material | null }): ItemEstimate {
  const { serviceIds, material } = params;
  if (serviceIds.length === 0) {
    throw new InvalidServiceSelectionError("Select at least one service.");
  }

  const services = lookUpServices(catalog, serviceIds);
  if (services.every((s) => s.isAddOn)) {
    throw new InvalidServiceSelectionError("Add-ons go with a cleaning or restoration service. Choose one to continue.");
  }
  if (services.filter((s) => s.isCleaningTier).length > 1) {
    throw new InvalidServiceSelectionError("Choose Standard or Premium Clean, not both.");
  }

  const cents = services.reduce((sum, s) => sum + s.baseCents, 0) + suedeFeeCents(material, services);
  return { estimate: Money.fromCents(cents), isMinimum: services.some((s) => s.isMinimum) };
}

/** The Bundle with this id, or null (e.g. a single-pair Order's null bundleId). */
export function findBundle(catalog: Catalog, id: string | null): CatalogBundle | null {
  return id === null ? null : (catalog.bundles.find((b) => b.id === id) ?? null);
}

/** False once a promotional Bundle's endsAt has passed. */
export function isBundleAvailable(bundle: CatalogBundle, now: Date): boolean {
  return bundle.endsAt === undefined || now.getTime() < Date.parse(bundle.endsAt);
}

/** The Services every pair of this Bundle gets. */
export function bundlePairServiceIds(bundle: CatalogBundle): string[] {
  return [...bundle.pairServiceIds];
}

export function catalogBundle(catalog: Catalog, id: string): CatalogBundle {
  const bundle = findBundle(catalog, id);
  if (!bundle) throw new InvalidServiceSelectionError(`Unknown bundle: ${id}`);
  return bundle;
}

/**
 * Each pair's share of a Bundle's fixed price, plus that pair's own
 * Add-ons. The price is split evenly, with leftover cents on the first
 * pairs, so the Items always sum to exactly the Bundle price plus its
 * Add-ons (CONTEXT.md: the Deposit is 50% of the sum of the Items). Flat,
 * and the Suede Fee is waived whatever the material.
 */
export function estimateBundleItems(catalog: Catalog, bundleId: string, addOnIdsByPair: string[][] = []): ItemEstimate[] {
  const { priceCents } = catalogBundle(catalog, bundleId);
  const share = Math.floor(priceCents / BUNDLE_PAIRS);
  const leftover = priceCents - share * BUNDLE_PAIRS;
  return Array.from({ length: BUNDLE_PAIRS }, (_, i) => ({
    estimate: Money.fromCents(share + (i < leftover ? 1 : 0) + addOnsCents(catalog, addOnIdsByPair[i] ?? [])),
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

export function catalogService(catalog: Catalog, id: string): CatalogService {
  const service = findService(catalog, id);
  if (!service) throw new InvalidServiceSelectionError(`Unknown service: ${id}`);
  return service;
}

/**
 * ADR-0017: an Item needs a Quote (and the customer's approval) only if one
 * of its Services is Restoration or Custom Work. Cleaning and Add-on
 * Services are flat-priced, so an Item with only those gets its published
 * price straight away.
 */
export function itemRequiresQuote(catalog: Catalog, serviceIds: string[]): boolean {
  return serviceIds.some((id) => {
    // An id missing from the catalog reads as flat-priced.
    const category = findService(catalog, id)?.category;
    return category === "restoration" || category === "custom-work";
  });
}

/** Whether a pair with these Services needs a Quote, answerable without a whole Catalog (a repository only has the services table). */
export type RequiresQuote = (serviceIds: string[]) => boolean;

/** `itemRequiresQuote` bound to a Catalog, for the domain functions that take a RequiresQuote. */
export function quoteCheck(catalog: Catalog): RequiresQuote {
  return (serviceIds) => itemRequiresQuote(catalog, serviceIds);
}

/** The lowest flat price a pair can be booked at: the cheapest active cleaning tier, e.g. "$30". Null if none is on offer. */
export function startingPrice(catalog: Catalog): string | null {
  const cleaning = catalog.services.filter((s) => s.active && s.isCleaningTier).sort((a, b) => a.baseCents - b.baseCents)[0];
  return cleaning ? formatPrice(cleaning.baseCents, cleaning.isMinimum) : null;
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
  return [...alsoFromNotes(service), ...(service.suedeFeeCents > 0 ? [suedeFeeNote(service.suedeFeeCents, false)] : [])];
}

export function suedeFeeNote(feeCents: number, applied: boolean): string {
  const fee = Money.fromCents(feeCents).format();
  return applied ? `Includes +${fee} Suede fee` : `+${fee} for Suede`;
}

export function rushFeeNote(): string {
  return `+${Money.fromCents(RUSH_FEE_CENTS).format()} rush`;
}
