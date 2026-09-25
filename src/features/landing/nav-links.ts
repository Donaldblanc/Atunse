// Shared primary nav — mapped over by SiteNav, NavDrawer, and SiteFooter so
// the link set can't drift between them. "Process" still points at
// /coming-soon — there's no real process page yet (docs/TODO.md). Gallery
// is a real in-page anchor on the home page, so it routes through "/"
// first when viewed elsewhere. `activeKey` matches the `active` prop these
// components already take; links without one (Gallery, Process) never get
// the active-link treatment.
export type NavActiveKey = "services" | "about";

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
