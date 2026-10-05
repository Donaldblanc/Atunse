import { orderIdFromSearchParams } from "../order-links";
import { ReturnBookingDialog } from "../visit-schedule-dialogs";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesReturnBooking = (params: OverviewParams) => orderIdFromSearchParams(params) !== null && params.book === "return";

export function ReturnBookingSlot({ params, selection, actingUser, now }: OverviewDialogContext) {
  const orderId = orderIdFromSearchParams(params);
  // ?book=return shows only the Return picker, which loads what it needs itself.
  return orderId && <ReturnBookingDialog orderId={orderId} selection={selection} actingUser={actingUser} now={now} />;
}
