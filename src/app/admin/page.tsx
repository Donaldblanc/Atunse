// Reachable only past src/middleware.ts's admin guard (AdminCheck) — the
// admin surface is protected from the very first deployment.
//
// This is the admin landing page from the MVP screen inventory
// (docs/SPEC.md): a dashboard that orients the owner and links into the
// working screens as they're built. The queues/detail screens themselves
// are Phase 2 — this page names them rather than linking to routes that
// don't exist yet. Visual system: design-system/atunse-admin/MASTER.md
// (ui-ux-pro-max skill) via admin/layout.tsx + styles/admin-theme.css.
import {
  QueueIcon,
  MagnifyingGlassIcon,
  CreditCardIcon,
  UsersIcon,
  GearIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/dist/ssr";

const PLANNED_SCREENS = [
  { title: "Orders queue", description: "All orders/items, filterable by status — the main working view.", status: "Next up", icon: QueueIcon },
  { title: "Under-Review queue", description: "Items awaiting a quote (every Item requires manual review).", status: "Planned", icon: MagnifyingGlassIcon },
  { title: "Awaiting payment confirmation", description: "Zelle/Cash items with a deposit or balance not yet marked received.", status: "Planned", icon: CreditCardIcon },
  { title: "Customers", description: "Customer list, order history, linked guest orders.", status: "Planned", icon: UsersIcon },
  { title: "Settings", description: "Service/pricing reference and policy documents.", status: "Planned", icon: GearIcon },
];

const STATS: { label: string; value: string; delta?: string; tone?: "up" }[] = [
  { label: "Open items", value: "—", delta: "Live once the Orders queue ships" },
  { label: "Awaiting review", value: "—" },
  { label: "Awaiting payment", value: "—" },
  { label: "Completed this week", value: "—" },
];

export default function AdminHomePage() {
  return (
    <>
      <div className="admin-topbar">
        <div>
          <div className="admin-eyebrow">RestoredByDJ · Internal</div>
          <h1 className="admin-h1">Dashboard</h1>
          <p className="admin-subtitle">
            One place to run every job end to end — quote, confirm payment, track progress, hand back a clean pair.
          </p>
        </div>
        <span className="admin-badge" data-tone="brand">
          Single-admin mode
        </span>
      </div>

      <div className="admin-stat-grid">
        {STATS.map((stat) => (
          <div className="admin-stat-card" key={stat.label}>
            <div className="admin-stat-label">{stat.label}</div>
            <div className="admin-stat-value">{stat.value}</div>
            {stat.delta && (
              <div className="admin-stat-delta" data-tone={stat.tone}>
                {stat.delta}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="admin-card">
        <h2 className="admin-section-title">
          <TrendUpIcon size={18} weight="bold" aria-hidden="true" />
          Coming next
        </h2>
        <div className="admin-screen-grid">
          {PLANNED_SCREENS.map((screen) => {
            const Icon = screen.icon;
            return (
              <div className="admin-screen-card" key={screen.title}>
                <div className="admin-screen-card-title">
                  <span className="admin-screen-card-title-text">
                    <Icon size={17} weight="regular" aria-hidden="true" />
                    {screen.title}
                  </span>
                  <span className="admin-badge">{screen.status}</span>
                </div>
                <div className="admin-screen-card-desc">{screen.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
