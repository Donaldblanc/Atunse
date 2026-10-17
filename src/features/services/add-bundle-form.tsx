"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBundleAction, type CatalogFormState } from "./catalog-actions";

/** Bundles tab's Add Bundle: name, price and perks; new bundles start Active. */
export function AddBundleForm({ closeHref }: { closeHref: string }) {
  const [state, formAction, pending] = useActionState<CatalogFormState, FormData>(createBundleAction, { error: null });

  return (
    <form action={formAction} className="sv-form">
      <input type="hidden" name="returnTo" value={closeHref} />

      <label className="sv-field" htmlFor="sv-new-bundle-name">
        <span className="sv-label">Bundle Name *</span>
        <input id="sv-new-bundle-name" name="name" type="text" maxLength={100} required className="sv-input" />
      </label>

      <label className="sv-field" htmlFor="sv-new-bundle-price">
        <span className="sv-label">Price *</span>
        <input id="sv-new-bundle-price" name="priceDollars" type="number" min="0" step="0.01" required className="sv-input" />
      </label>

      <label className="sv-field" htmlFor="sv-new-bundle-perks">
        <span className="sv-label">Perks (one per line)</span>
        <textarea id="sv-new-bundle-perks" name="perks" rows={4} className="sv-textarea" />
      </label>

      <p className="sv-hint">New bundles aren&apos;t offered in booking until booking reads these tables.</p>

      {state.error && (
        <p role="alert" className="sv-error">
          {state.error}
        </p>
      )}

      <div className="sv-actions">
        <div className="sv-actions-right">
          <Link href={closeHref} replace scroll={false} className="admin-btn" data-variant="secondary">
            Cancel
          </Link>
          <button type="submit" className="admin-btn" disabled={pending}>
            {pending ? "Adding…" : "Add Bundle"}
          </button>
        </div>
      </div>
    </form>
  );
}
