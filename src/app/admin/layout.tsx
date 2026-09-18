import "@/styles/admin-theme.css";
import {
  SquaresFourIcon,
  QueueIcon,
  MagnifyingGlassIcon,
  CreditCardIcon,
  UsersIcon,
  GearIcon,
} from "@phosphor-icons/react/dist/ssr";

// Shared shell for every admin screen (dashboard today; queues/detail
// screens as they land). Reachable only past src/middleware.ts's AdminCheck
// guard — this layout is purely presentational, it does not re-check auth.
// Visual system: design-system/atunse-admin/MASTER.md (ui-ux-pro-max skill).
const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", active: true, icon: SquaresFourIcon },
  { label: "Orders queue", href: "#", active: false, icon: QueueIcon },
  { label: "Under review", href: "#", active: false, icon: MagnifyingGlassIcon },
  { label: "Awaiting payment", href: "#", active: false, icon: CreditCardIcon },
  { label: "Customers", href: "#", active: false, icon: UsersIcon },
  { label: "Settings", href: "#", active: false, icon: GearIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
