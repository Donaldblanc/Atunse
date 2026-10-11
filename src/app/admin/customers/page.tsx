// The admin Customers screen's list (ADR-0014: Customer Accounts). Each
// row opens the Account's detail (/admin/customers/[id]).

import Link from "next/link";
import { cookies } from "next/headers";
import { actingUserFromCookies } from "@/features/accounts/acting-user";
import { buildAdminCustomersDeps } from "@/features/admin-customers/deps";
import { listCustomers } from "@/features/admin-customers/list-customers";
import { bookedDay } from "@/features/admin-overview/get-admin-overview";

export const metadata = { title: "Customers · Atunṣe Admin" };

export default async function AdminCustomersPage() {
  const actingUser = await actingUserFromCookies(await cookies());
  const customers = await listCustomers(buildAdminCustomersDeps(), actingUser);

  return (
    <div className="ov">
      <div className="ov-card">
        <div className="ov-card-head">
          <h2 className="ov-card-title">Customers</h2>
        </div>
        {customers.length === 0 ? (
          <p className="ov-empty">No customers yet.</p>
        ) : (
          <div className="ov-table-scroll">
            <table className="ov-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Since</th>
                  <th scope="col" className="ov-num">
                    Orders
                  </th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="ov-row-link">
                    <td>
                      <Link href={`/admin/customers/${customer.id}`} className="ov-cell-main">
                        {customer.name ?? customer.email}
                      </Link>
                    </td>
                    <td>{customer.email}</td>
                    <td>{customer.phone ?? "—"}</td>
                    <td className="ov-cell-sub">{bookedDay.format(customer.createdAt)}</td>
                    <td className="ov-num">{customer.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
