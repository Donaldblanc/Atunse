// The standalone Order detail (/admin/orders/[id]): the Overview's
// ?order= dialog's own content, promoted to a real page with its own URL.
// Reuses getOrderDetail and the dialog's action forms as-is; only the shell
// around them (a page, not a modal) is new.

import "./order-detail-page.css";
import { ArrowLeftIcon, PackageIcon, PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { SHOP_TIMEZONE } from "@/features/orders/calendar-date";
import { ITEM_STATUS_LABELS } from "@/features/orders/domain";
import { getOrderDetail } from "@/features/admin-overview/order-detail";
import { buildOrderDetailDeps } from "@/features/admin-overview/order-detail-deps";
import { OrderDetailBody } from "@/features/admin-overview/order-detail-dialog";
import { STATUS_TONE } from "@/features/admin-overview/status-tone";
import { DEFAULT_OVERVIEW_RANGE } from "@/features/admin-overview/overview-range";
import { BookReturnAction } from "@/features/admin-overview/visit-schedule-dialogs";

// Shared by generateMetadata and the page component, so one request only loads the order once.
const loadOrderDetail = cache(async (id: string) => {
  const actingUser = await actingUserFromCookies(await cookies());
  return getOrderDetail(buildOrderDetailDeps(), actingUser, id);
});

const shopBooked = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: SHOP_TIMEZONE,
});

type PageParams = Promise<{ id: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export async function generateMetadata({ params }: { params: PageParams }) {
  const { id } = await params;
  const detail = await loadOrderDetail(id);
  return { title: detail ? `${detail.reference} · Atunṣe Admin` : "Order not found · Atunṣe Admin" };
}

export default async function OrderDetailPage({ params, searchParams }: { params: PageParams; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const detail = await loadOrderDetail(id);
  if (!detail) notFound();

  const pageHref = `/admin/orders/${id}`;
  const editHref = `${pageHref}?edit=order`;
  const editing = query.edit === "order";

  return (
    <div className="od-page">
      <Link href="/admin/orders" className="od-back-link">
        <ArrowLeftIcon size={16} aria-hidden="true" /> Back to Orders
      </Link>
      <div className="od-page-head">
        <span className="od-title">
          <span className="od-title-icon" aria-hidden="true">
            <PackageIcon size={26} weight="light" />
          </span>
          <span>
            <span className="od-eyebrow">Order</span>
            <span className="od-reference">{detail.reference}</span>
            <span className="od-title-meta">
              <span className="ov-pill" data-tone={STATUS_TONE[detail.status]}>
                {ITEM_STATUS_LABELS[detail.status]}
              </span>
              <span className="od-muted">Booked {shopBooked.format(detail.bookedAt)}</span>
            </span>
          </span>
        </span>
        {!editing && (
          <Link href={editHref} className="admin-btn" data-variant="secondary">
            <PencilSimpleIcon size={16} aria-hidden="true" /> Edit Order
          </Link>
        )}
      </div>
      <OrderDetailBody
        detail={detail}
        viewHref={pageHref}
        editing={editing}
        returnAction={<BookReturnAction orderId={id} returnVisit={detail.returnVisit} selection={DEFAULT_OVERVIEW_RANGE} replaceHistory={false} />}
      />
    </div>
  );
}
