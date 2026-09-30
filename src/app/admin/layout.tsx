import "@/styles/admin-theme.css";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminFromCookieValue } from "@/features/accounts/admin-check";
import { SESSION_COOKIE_NAME } from "@/features/accounts/session";
import { AccountMenu } from "./account-menu";
import { AdminNav } from "./admin-nav";
import { OWNER_DISPLAY_NAME } from "./admin-screens";

// Shared shell for every admin screen: the dark sidebar and the top bar
// from the design (scratch/overview-dashboard.jpeg), in the site's Inter
// type and blue accent. Reachable only past src/proxy.ts's admin
// guard, and it re-checks the session itself too (defense in depth).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // src/proxy.ts already guards every /admin request; this is a second,
  // independent check (defense in depth), so a proxy misconfiguration or
  // bypass still can't render admin pages.
  const { allowed } = await adminFromCookieValue((await cookies()).get(SESSION_COOKIE_NAME)?.value);
  if (!allowed) redirect("/sign-in");

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <span className="admin-brand-name">ATUNṢE</span>
            <span className="admin-brand-tag">Restore more than sneakers.</span>
          </div>
          <AdminNav />
          <AccountMenu name={OWNER_DISPLAY_NAME} role="Admin" placement="sidebar" />
        </aside>

        <div className="admin-body">
          <header className="admin-topbar">
            {/* Search arrives with the Orders screen, which it searches. */}
            <label className="admin-search">
              <MagnifyingGlassIcon size={18} aria-hidden="true" />
              <span className="sr-only">Search</span>
              <input type="search" placeholder="Search orders, customers, or reference #…" disabled title="Search arrives with the Orders screen" />
            </label>
            <AccountMenu name={OWNER_DISPLAY_NAME} role="Admin" placement="topbar" />
          </header>

          <main className="admin-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
