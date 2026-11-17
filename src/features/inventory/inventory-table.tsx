// The Inventory screen's table (design: scratch/inventory.jpeg). Each row
// links to its own item panel via `?item=`.

import Link from "next/link";
import { PackageIcon } from "@phosphor-icons/react/dist/ssr";
import { itemStatus, STATUS_LABELS } from "./inventory-labels";
import type { InventoryItemRecord } from "./repositories/inventory-repository";

export function InventoryTable({
  rows,
  thumbnails,
  buildDetailHref,
  selectedId,
}: {
  rows: InventoryItemRecord[];
  /** A view link for each row's first image, by item id (null or missing: the placeholder). */
  thumbnails: Record<string, string | null>;
  buildDetailHref: (id: string) => string;
  selectedId: string | null;
}) {
  if (rows.length === 0) return <p className="ov-empty">No inventory items match these filters.</p>;

  return (
    <div className="att-scroll">
      <table className="ov-table inv-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Category</th>
            <th scope="col">SKU</th>
            <th scope="col">Stock</th>
            <th scope="col">Low Stock</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = itemStatus(row);
            const thumbnail = thumbnails[row.id];
            return (
              <tr key={row.id} className="ov-row-link" aria-current={row.id === selectedId ? "true" : undefined}>
                <td>
                  <div className="inv-item">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed storage URL, not a static asset
                      <img src={thumbnail} alt="" className="inv-thumb" />
                    ) : (
                      <span className="inv-thumb inv-thumb-empty" aria-hidden="true">
                        <PackageIcon size={20} />
                      </span>
                    )}
                    <div className="inv-item-text">
                      <Link className="att-link inv-item-name" href={buildDetailHref(row.id)} scroll={false}>
                        {row.name}
                      </Link>
                      {row.description && <span className="ov-cell-sub inv-item-desc">{row.description}</span>}
                    </div>
                  </div>
                </td>
                <td>{row.category}</td>
                <td className="ov-ref">{row.sku ?? "—"}</td>
                <td className="inv-num" data-low={status === "OUT_OF_STOCK" ? "true" : undefined}>
                  {row.stock}
                </td>
                <td className="inv-num">{row.lowStockAt}</td>
                <td>
                  <span className="inv-status" data-status={status}>
                    {STATUS_LABELS[status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
