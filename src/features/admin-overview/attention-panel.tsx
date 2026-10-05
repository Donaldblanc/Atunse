import Link from "next/link";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import type { AttentionPanelData } from "./attention-panels";
import { overviewHref, type OverviewSelection } from "./overview-range";
import { PendingPaymentsTable } from "./pending-payments-table";

/**
 * The dialog behind a Needs Attention item (`?attention=`), from rows the
 * page loaded (getAttentionPanel). Pending Payments can mark a Deposit
 * paid; the other two are read-only lists whose Order links open the Order
 * dialog, where the actions live.
 */
export function AttentionPanel({ data, selection }: { data: AttentionPanelData; selection: OverviewSelection }) {
  const closeHref = overviewHref(selection);
  const linkTo = (orderId: string) => overviewHref(selection, { order: orderId });

  if (data.panel === "pending-payments") {
    const { rows } = data;
    return (
      <AdminDialog title={`Pending Payments (${rows.length})`} closeHref={closeHref} size="lg">
        <PendingPaymentsTable rows={rows.map((row) => ({ ...row, href: linkTo(row.orderId) }))} />
      </AdminDialog>
    );
  }

  if (data.panel === "ready-to-return") {
    const { rows } = data;
    // Pairs, not Orders, like the stat card and Needs Attention row that open this.
    const pairsReady = rows.reduce((sum, row) => sum + row.pairsReady, 0);
    return (
      <AdminDialog title={`Ready to Return (${pairsReady})`} closeHref={closeHref} size="lg">
        {rows.length === 0 ? (
          <p className="ov-empty">Nothing is waiting to go back.</p>
        ) : (
          <div className="att-scroll">
            <table className="ov-table att-table">
              <thead>
                <tr>
                  <th scope="col">Order #</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Pairs Ready</th>
                  <th scope="col">Return</th>
                  <th scope="col">Booked</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.orderId}>
                    <td className="ov-ref">
                      <Link className="att-link" href={linkTo(row.orderId)} scroll={false}>
                        {row.reference}
                      </Link>
                    </td>
                    <td>
                      <span className="ov-cell-main">{row.customerName}</span>
                    </td>
                    <td>{row.pairsReady}</td>
                    <td>{row.fulfillment}</td>
                    <td>{row.bookedOn}</td>
                    <td>
                      <div className="att-actions-cell">
                        <Link className="admin-btn att-action" data-variant="secondary" href={linkTo(row.orderId)} scroll={false}>
                          View
                        </Link>
                        {row.returnVisit.kind === "bookable" ? (
                          <Link className="admin-btn att-action" data-variant="secondary" href={overviewHref(selection, { order: row.orderId, book: "return" })} scroll={false}>
                            Book return
                          </Link>
                        ) : row.returnVisit.kind === "booked" ? (
                          <Link className="admin-btn att-action" data-variant="secondary" href={overviewHref(selection, { visit: row.returnVisit.appointmentId })} scroll={false}>
                            {row.returnVisit.when}
                          </Link>
                        ) : (
                          <span className="ov-cell-sub">Ships back</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminDialog>
    );
  }

  const { rows } = data;
  return (
    <AdminDialog title={`Needs a Quote (${rows.length})`} closeHref={closeHref} size="lg">
      {rows.length === 0 ? (
        <p className="ov-empty">No pairs are waiting on a quote.</p>
      ) : (
        <div className="att-scroll">
          <table className="ov-table att-table">
            <thead>
              <tr>
                <th scope="col">Order #</th>
                <th scope="col">Customer</th>
                <th scope="col">Pair</th>
                <th scope="col">Services</th>
                <th scope="col">Booked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.itemId}>
                  <td className="ov-ref">
                    <Link className="att-link" href={linkTo(row.orderId)} scroll={false}>
                      {row.reference}
                    </Link>
                  </td>
                  <td>
                    <span className="ov-cell-main">{row.customerName}</span>
                  </td>
                  <td>{row.pair}</td>
                  <td>{row.services}</td>
                  <td>{row.bookedOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminDialog>
  );
}
