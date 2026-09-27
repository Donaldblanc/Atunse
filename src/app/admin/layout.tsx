import "@/styles/admin-theme.css";
import {
  SquaresFourIcon,
  QueueIcon,
  MagnifyingGlassIcon,
  CreditCardIcon,
  UsersIcon,
  GearIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminFromCookieValue } from "@/features/accounts/admin-check";
import { SESSION_COOKIE_NAME } from "@/features/accounts/session";
import { SignOutButton } from "./sign-out-button";

// Shared shell for every admin screen (dashboard today; queues/detail
// screens as they land). Reachable only past src/proxy.ts's admin guard,
// and it re-checks the session itself too (defense in depth).
// Visual system: design-system/atunse-admin/MASTER.md (ui-ux-pro-max skill).
const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", active: true, icon: SquaresFourIcon },
  { label: "Orders queue", href: "#", active: false, icon: QueueIcon },
  { label: "Under review", href: "#", active: false, icon: MagnifyingGlassIcon },
  { label: "Awaiting payment", href: "#", active: false, icon: CreditCardIcon },
  { label: "Customers", href: "#", active: false, icon: UsersIcon },
  { label: "Settings", href: "#", active: false, icon: GearIcon },
];

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
            <span className="admin-brand-mark" aria-hidden="true">
              <SquaresFourIcon size={18} weight="bold" />
            </span>
            Atunṣe Admin
          </div>

          <nav className="admin-nav" aria-label="Admin sections">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="admin-nav-item"
                  data-active={item.active ? "true" : "false"}
                  aria-current={item.active ? "page" : undefined}
                >
                  <span className="admin-nav-icon" aria-hidden="true">
                    <Icon size={18} weight={item.active ? "fill" : "regular"} />
                  </span>
                  {item.label}
                </a>
              );
            })}
          </nav>

          <SignOutButton />

          <div className="admin-sidebar-footer">
            RestoredByDJ
            <br />
            Internal use only
          </div>
        </aside>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
