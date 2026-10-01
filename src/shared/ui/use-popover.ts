"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Open/close state for a non-modal popover (a disclosure: a button that
 * shows a small panel), e.g. the admin account menu and date-range picker.
 * Closes on Escape (focus goes back to the button) and on a click outside.
 * Put `rootRef` on an element wrapping both the button and the panel.
 */
export function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      rootRef.current?.querySelector<HTMLElement>("[aria-expanded]")?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, toggle: () => setOpen((value) => !value), rootRef };
}
