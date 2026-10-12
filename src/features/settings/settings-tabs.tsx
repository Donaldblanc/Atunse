// The Settings tab strip (docs/plans/admin-screens-batch-2.md). Only
// Business Profile is a real tab today; "Operating Hours" anchors into the
// same page's Operating Hours section rather than a second route, since
// the design shows it rendered under Business Profile already. The rest
// (docs/TODO.md #182: not modeled yet) render disabled, same convention as
// the sidebar's unbuilt screens (admin-nav.tsx).

const SOON_TABS = ["Notifications", "Payments", "Shipping & Pickup", "Email & Templates", "Team", "Billing"];

export function SettingsTabs({ active }: { active: "business" }) {
  return (
    <nav className="st-tabs" aria-label="Settings sections">
      <a href="#business-information" className="st-tab" data-active={active === "business" ? "true" : undefined} aria-current={active === "business" ? "page" : undefined}>
        Business Profile
      </a>
      <a href="#operating-hours" className="st-tab">
        Operating Hours
      </a>
      {SOON_TABS.map((label) => (
        <span key={label} className="st-tab" data-soon="true" aria-disabled="true">
          {label}
          <span className="st-soon">Soon</span>
        </span>
      ))}
    </nav>
  );
}
