"use client";

import { XIcon } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef } from "react";

/**
 * The admin screens' one modal: a native <dialog> opened with showModal(),
 * so focus is trapped, Escape closes it and the page behind is inert,
 * without re-implementing any of that.
 *
 * It's driven by the URL: a server page renders it when its query param is
 * present (e.g. `/admin?order=…`), so a detail panel survives a reload and
 * can be linked to. Closing it (the X, Escape, or a click on the backdrop)
 * navigates to `closeHref`, the same page without that param.
 */
export function AdminDialog({
  title,
  closeHref,
  size = "md",
  actions,
  children,
}: {
  title: React.ReactNode;
  closeHref: string;
  size?: "sm" | "md" | "lg";
  /** Buttons for the header, beside the close button (e.g. Edit Order). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const titleId = useId();
  // Whether the current press started on the backdrop (see onClick).
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function close() {
    router.replace(closeHref, { scroll: false });
  }

  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      data-size={size}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: leave the dialog open until the URL change removes it, so it doesn't flash closed and back.
        event.preventDefault();
        close();
      }}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself, not its contents.
        // So does a drag that starts inside (selecting an email) and ends on the
        // backdrop, so the press must have started there too.
        if (event.target === event.currentTarget && pressedBackdrop.current) close();
        pressedBackdrop.current = false;
      }}
    >
      <div className="admin-dialog-body">
        <div className="admin-dialog-head">
          <h2 id={titleId} className="admin-dialog-title">
            {title}
          </h2>
          {actions && <div className="admin-dialog-actions">{actions}</div>}
          <button type="button" className="admin-dialog-close" aria-label="Close" onClick={close}>
            <XIcon size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
