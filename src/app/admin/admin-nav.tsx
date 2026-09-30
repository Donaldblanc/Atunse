"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SCREENS } from "./admin-screens";

/** The sidebar's screen list; the current screen is highlighted. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {ADMIN_SCREENS.map((screen) => {
        const Icon = screen.icon;
        const active = screen.href === "/admin" ? pathname === "/admin" : pathname.startsWith(screen.href);

        if (!screen.built) {
          return (
            <span key={screen.id} className="admin-nav-item" data-soon="true" aria-disabled="true">
              <Icon size={20} aria-hidden="true" />
              <span className="admin-nav-label">{screen.label}</span>
              <span className="admin-nav-soon">Soon</span>
            </span>
          );
        }

        return (
          <Link
            key={screen.id}
            href={screen.href}
            className="admin-nav-item"
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
            <span className="admin-nav-label">{screen.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
