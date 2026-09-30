"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import { useId } from "react";
import { usePopover } from "@/shared/ui/use-popover";
import { SignOutButton } from "./sign-out-button";

/** The owner's initials in the top bar, opening a menu with Sign out. */
export function AccountMenu({ name }: { name: string }) {
  const { open, toggle, rootRef } = usePopover<HTMLDivElement>();
  const panelId = useId();

  return (
    <div className="admin-account" ref={rootRef}>
      <button type="button" className="admin-account-button" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <span className="admin-avatar" aria-hidden="true">
          {name.slice(0, 2).toUpperCase()}
        </span>
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
