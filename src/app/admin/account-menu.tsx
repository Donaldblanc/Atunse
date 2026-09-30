"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import { useId } from "react";
import { usePopover } from "@/shared/ui/use-popover";
import { SignOutButton } from "./sign-out-button";

/**
 * The owner's account menu (Sign out). Two placements from the design:
 * initials in the top bar, and a name card at the foot of the sidebar,
 * whose menu opens upwards.
 */
export function AccountMenu({ name, role, placement }: { name: string; role: string; placement: "topbar" | "sidebar" }) {
  const { open, toggle, rootRef } = usePopover<HTMLDivElement>();
  const panelId = useId();
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="admin-account" data-placement={placement} ref={rootRef}>
      <button type="button" className="admin-account-button" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <span className="admin-avatar" aria-hidden="true">
          {initials}
        </span>
        {placement === "sidebar" ? (
          <span className="admin-account-who">
            <strong>{name}</strong>
            <span>{role}</span>
          </span>
        ) : null}
        <span className="sr-only">Account menu for {name}</span>
        <CaretDownIcon size={14} weight="bold" aria-hidden="true" />
      </button>
      <div id={panelId} className="admin-popover admin-account-panel" hidden={!open}>
        <p className="admin-account-name">Signed in as {name}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
