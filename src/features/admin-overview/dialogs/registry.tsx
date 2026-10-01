import type { ReactNode } from "react";
import { AttentionSlot, matchesAttention } from "./attention-slot";
import { LowStockSlot, matchesLowStock } from "./low-stock-slot";
import { matchesMetric, MetricSlot } from "./metric-slot";
import { matchesReviews, ReviewsSlot } from "./reviews-slot";
import { matchesOrder, OrderSlot } from "./order-slot";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";
import { matchesReturnBooking, ReturnBookingSlot } from "./return-booking-slot";
import { matchesVisit, VisitSlot } from "./visit-slot";

export interface OverviewDialogSlot {
  id: string;
  /** True when the URL's params ask for this dialog. */
  matches(params: OverviewParams): boolean;
  /** A server component that loads its own data and renders the dialog. */
  Slot(ctx: OverviewDialogContext): ReactNode | Promise<ReactNode>;
}

/** Render order. A new dialog is one slot file plus one line here. */
export const OVERVIEW_DIALOGS: OverviewDialogSlot[] = [
  { id: "metric", matches: matchesMetric, Slot: MetricSlot },
  { id: "visit", matches: matchesVisit, Slot: VisitSlot },
  { id: "return-booking", matches: matchesReturnBooking, Slot: ReturnBookingSlot },
  { id: "order", matches: matchesOrder, Slot: OrderSlot },
  { id: "attention", matches: matchesAttention, Slot: AttentionSlot },
  { id: "low-stock", matches: matchesLowStock, Slot: LowStockSlot },
  { id: "reviews", matches: matchesReviews, Slot: ReviewsSlot },
];

/** The ids of the slots these params open, in render order. */
export function matchingDialogIds(params: OverviewParams): string[] {
  return OVERVIEW_DIALOGS.filter((dialog) => dialog.matches(params)).map((dialog) => dialog.id);
}

export function OverviewDialogs({ ctx }: { ctx: OverviewDialogContext }) {
  return OVERVIEW_DIALOGS.filter((dialog) => dialog.matches(ctx.params)).map(({ id, Slot }) => <Slot key={id} {...ctx} />);
}
