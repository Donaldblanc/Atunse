import { RUSH_FEE_CENTS, SUEDE_FEE_CENTS } from "@/features/orders/service-catalog";

// Whole dollars for display; the catalog (server source of truth) holds cents.
export const RUSH_FEE = RUSH_FEE_CENTS / 100;
export const SUEDE_FEE = SUEDE_FEE_CENTS / 100;

export type PricedService = {
  name: string;
  price: string;
  priceNote?: string;
  suedeFee?: boolean;
};

export type ComputedPricing = {
  name: string;
  price: string;
  priceNote: string | undefined;
};

// Single-pair services are additive — a customer can select Standard
// Clean, Oxidation Restoration, and Painting all on the same pair — so
// price/name/note are computed over the whole selected set, not one
// service. Only services with `suedeFee: true` (Standard/Premium Clean)
// carry the flat +$10 Suede fee, and it's only real when the customer
// actually picked Suede as the pair's material, not just a disclaimer
// note that never changed the price. Range-priced services (e.g.
// "Starting at $40+") contribute their leading number to the running
// total and force a trailing "+" on it, since the real total is
// condition-dependent. Each service's own priceNote (e.g. Oxidation's
// "Sole from $40+") is preserved alongside the suede/rush notes rather
// than being dropped.
export function computeMultiServicePricing(services: PricedService[], material: string, rush: boolean): ComputedPricing {
  if (services.length === 0) return { name: "No service selected", price: "$0", priceNote: undefined };

  const name = services.map((s) => s.name).join(" + ");
  const anyNonFlat = services.some((s) => !/^\$\d+$/.test(s.price));
  const hasSuedeFee = services.some((s) => s.suedeFee);
  const suedeApplies = hasSuedeFee && material === "Suede";
  const baseTotal = services.reduce((sum, s) => {
    const match = s.price.match(/\d+/);
    return sum + (match ? parseInt(match[0], 10) : 0);
  }, 0);
  const total = baseTotal + (suedeApplies ? SUEDE_FEE : 0) + (rush ? RUSH_FEE : 0);

  // Services with suedeFee carry a priceNote that just restates the fee
  // ("+$10 for Suede") — that's superseded by the generated suede note
  // below, so exclude those specifically rather than string-matching the
  // note's wording (which could drift independently of the flag).
  const ownNotes = services.filter((s) => !s.suedeFee).map((s) => s.priceNote).filter((n): n is string => Boolean(n));
  const notes = [
    ...ownNotes,
    hasSuedeFee ? (suedeApplies ? `Includes +$${SUEDE_FEE} Suede fee` : `+$${SUEDE_FEE} for Suede`) : null,
    rush ? `+$${RUSH_FEE} rush` : null,
  ].filter((n): n is string => Boolean(n));

  return {
    name,
    price: `$${total}${total > 0 && anyNonFlat ? "+" : ""}`,
    priceNote: notes.length > 0 ? notes.join(" · ") : undefined,
  };
}
