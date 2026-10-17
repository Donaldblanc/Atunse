// A Customer Account's detail (ADR-0014): contact info and Order history.
// Each Order links to the standalone /admin/orders/[id] page.

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { getCustomerDetail } from "@/features/admin-customers/customer-detail";
import { buildAdminCustomersDeps } from "@/features/admin-customers/deps";
import { bookedDay } from "@/features/admin-overview/get-admin-overview";
import { STATUS_TONE } from "@/features/admin-overview/status-tone";
import { ITEM_STATUS_LABELS } from "@/features/orders/domain";

export const metadata = { title: "Customer · Atunṣe Admin" };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actingUser = await actingUserFromCookies(await cookies());
  const customer = await getCustomerDetail(buildAdminCustomersDeps(), actingUser, id);
  if (!customer) notFound();

  return (
    <div className="ov">
      {/* .ov's grid is 1fr main column + 380px sidebar: history needs the
          width, so it goes first (main column) and the compact contact
          card second (sidebar), not JSX declaration order. */}
      <div className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-card-title">Order history</h2>
        </div>
        {customer.orders.length === 0 ? (
          <p className="ov-empty">No orders yet.</p>
        ) : (
          <div className="ov-table-scroll">
            <table className="ov-table">
              <thead>
                <tr>
                  <th scope="col">Order #</th>
                  <th scope="col">Booked</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="ov-num">
                    Estimate
                  </th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.orderId} className="ov-row-link">
                    <td>
                      <Link href={`/admin/orders/${order.orderId}`} className="ov-cell-main">
                        {order.reference}
                      </Link>
                    </td>
                    <td className="ov-cell-sub">{bookedDay.format(order.createdAt)}</td>
                    <td>
                      <span className="ov-pill" data-tone={STATUS_TONE[order.status]}>
                        {ITEM_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="ov-num ov-total">{order.estimate.format()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-card-title">{customer.name ?? customer.email}</h2>
        </div>
        <dl>
          <dt>Email</dt>
          <dd>{customer.email}</dd>
          <dt>Phone</dt>
          <dd>{customer.phone ?? "—"}</dd>
          <dt>Customer since</dt>
          <dd>{bookedDay.format(customer.createdAt)}</dd>
        </dl>
      </div>
    </div>
  );
}
