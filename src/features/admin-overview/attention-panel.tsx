import Link from "next/link";
import type { ActingUser } from "@/features/accounts/authz";
import { AdminDialog } from "@/shared/ui/admin-dialog";
import { buildAttentionPanelDeps } from "./attention-deps";
import { getNeedsQuote, getPendingPayments, getReadyToReturn, type AttentionPanelId } from "./attention-panels";
import { overviewHref, type OverviewSelection } from "./overview-range";
import { PendingPaymentsTable } from "./pending-payments-table";

/**
 * The dialog behind a Needs Attention item (`?attention=`), loaded on the
 * server. Pending Payments can mark a Deposit paid; the other two are
 * read-only lists whose Order links open the Order dialog, where the
 * actions live.
 */
export async function AttentionPanel({
  panel,
  selection,
  actingUser,
}: {
  panel: AttentionPanelId;
  selection: OverviewSelection;
  actingUser: ActingUser;
}) {
  const deps = buildAttentionPanelDeps();
  const closeHref = overviewHref(selection);
  const linkTo = (orderId: string) => overviewHref(selection, { order: orderId });

  if (panel === "pending-payments") {
    const rows = await getPendingPayments(deps, actingUser);
    return (
      <AdminDialog title={`Pending Payments (${rows.length})`} closeHref={closeHref} size="lg">
        <PendingPaymentsTable rows={rows.map((row) => ({ ...row, href: linkTo(row.orderId) }))} />
      </AdminDialog>
    );
  }

  if (panel === "ready-to-return") {
    const rows = await getReadyToReturn(deps, actingUser);
    return (
      <AdminDialog title={`Ready to Return (${rows.length})`} closeHref={closeHref} size="lg">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminDialog>
    );
  }

  const rows = await getNeedsQuote(deps, actingUser);
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
