import { getOrderDetail } from "../order-detail";
import { buildOrderDetailDeps } from "../order-detail-deps";
import { OrderDetailDialog, OrderNotFoundDialog } from "../order-detail-dialog";
import { orderIdFromSearchParams } from "../order-links";
import { overviewHref } from "../overview-range";
import { BookReturnAction } from "../visit-schedule-dialogs";
import type { OverviewDialogContext, OverviewParams } from "./overview-dialog-context";

export const matchesOrder = (params: OverviewParams) => orderIdFromSearchParams(params) !== null && params.book !== "return";

export async function OrderSlot({ params, selection, actingUser, closeHref }: OverviewDialogContext) {
  const orderId = orderIdFromSearchParams(params);
  if (!orderId) return null;
  const orderDetail = await getOrderDetail(buildOrderDetailDeps(), actingUser, orderId);
  return orderDetail ? (
    <OrderDetailDialog
      detail={orderDetail}
      closeHref={closeHref}
      viewHref={overviewHref(selection, { order: orderId })}
      editHref={overviewHref(selection, { order: orderId, edit: "order" })}
      editing={params.edit === "order"}
      returnAction={<BookReturnAction orderId={orderId} returnVisit={orderDetail.returnVisit} selection={selection} />}
    />
  ) : (
    <OrderNotFoundDialog closeHref={closeHref} />
  );
}
