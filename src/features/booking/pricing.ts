import { Money } from "@/shared/money/money";
import {
  alsoFromNotes,
  catalogService,
  RUSH_FEE_CENTS,
  rushFeeNote,
  SUEDE_FEE_CENTS,
  suedeFeeNote,
} from "@/features/orders/service-catalog";

// Whole dollars for display copy (the Rush toggle's label).
export const RUSH_FEE = RUSH_FEE_CENTS / 100;
export const SUEDE_FEE = SUEDE_FEE_CENTS / 100;

/** One priced thing in the summary: a catalog Service, or a Bundle. */
export type PricedLine = {
  name: string;
  baseCents: number;
  isMinimum: boolean;
  suedeFee: boolean;
  /** Price notes other than the Suede fee, e.g. "Sole from $40+". */
  notes: string[];
};

export type ComputedPricing = {
  name: string;
  /** Integer cents, the same math as the server's estimateItem/estimateOrder. */
  totalCents: number;
  price: string;
  priceNote: string | undefined;
};

export function pricedLineForService(serviceId: string): PricedLine {
  const service = catalogService(serviceId);
  return {
    name: service.name,
    baseCents: service.baseCents,
    isMinimum: service.isMinimum,
    suedeFee: service.suedeFee,
    notes: alsoFromNotes(service),
  };
}

// Single-pair services are additive — a customer can select Standard
// Clean, Oxidation Restoration, and Painting all on the same pair — so
// price/name/note are computed over the whole selected set, not one
// service. Everything comes from SERVICE_CATALOG in integer cents, with
// the same rules as the server's estimate: the Suede fee is charged once,
// only when a suedeFee service is selected and the material is Suede;
// Rush is a flat fee on top; any minimum ("from $25+") price makes the
// total a minimum too.
export function computeMultiServicePricing(lines: PricedLine[], material: string, rush: boolean): ComputedPricing {
  if (lines.length === 0) return { name: "No service selected", totalCents: 0, price: "$0", priceNote: undefined };

  const hasSuedeFee = lines.some((line) => line.suedeFee);
  const suedeApplies = hasSuedeFee && material === "Suede";
  const totalCents =
    lines.reduce((sum, line) => sum + line.baseCents, 0) + (suedeApplies ? SUEDE_FEE_CENTS : 0) + (rush ? RUSH_FEE_CENTS : 0);
  const notes = [
    ...lines.flatMap((line) => line.notes),
    hasSuedeFee ? suedeFeeNote(suedeApplies) : null,
    rush ? rushFeeNote() : null,
  ].filter((n): n is string => Boolean(n));

  return {
    name: lines.map((line) => line.name).join(" + "),
    totalCents,
    price: `${Money.fromCents(totalCents).format()}${totalCents > 0 && lines.some((line) => line.isMinimum) ? "+" : ""}`,
    priceNote: notes.length > 0 ? notes.join(" · ") : undefined,
  };
}
