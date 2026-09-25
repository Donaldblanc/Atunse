// Shared primary nav — mapped over by SiteNav, NavDrawer, and SiteFooter so
// the link set can't drift between them. "Process" still points at
// /coming-soon — there's no real process page yet (docs/TODO.md). Gallery
// is a real in-page anchor on the home page, so it routes through "/"
// first when viewed elsewhere. `activeKey` matches the `active` prop these
// components already take; links without one (Gallery, Process) never get
// the active-link treatment.
export type NavActiveKey = "services" | "about";

// The `active` prop SiteNav/NavDrawer/SiteFooter take — a superset of
// NavActiveKey since "booking" has no NAV_LINKS entry (it only hides the
// "Book a restoration" CTA) but is still a valid page to be "on".
export type NavActive = NavActiveKey | "booking";

export type NavLink = {
  href: string;
  label: string;
  activeKey?: NavActiveKey;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/services", label: "Services", activeKey: "services" },
  { href: "/#gallery", label: "Gallery" },
  { href: "/coming-soon", label: "Process" },
  { href: "/about", label: "About", activeKey: "about" },
];

// Centralizes the "is this link the current page" comparison so it can't
// drift between SiteNav/NavDrawer/SiteFooter — a link with no activeKey
// (Gallery, Process) never matches, even when `active` is undefined.
export function navLinkClass(link: NavLink, active: NavActive | undefined): string | undefined {
  return link.activeKey !== undefined && link.activeKey === active ? "active-link" : undefined;
}
