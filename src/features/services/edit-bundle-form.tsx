"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { BundleRecord } from "./repositories/catalog-repository";
import { addBundleImageAction, removeBundleImageAction, requestBundleImageUploadAction, setBundleActiveAction, updateBundleAction, type CatalogFormState } from "./catalog-actions";
import { CatalogImageUploader } from "./catalog-image-uploader";

const NOTES_MAX = 500;

/** Edit Bundle: same shape as Edit Service — name, price, perks, Active, images, internal notes. */
export function EditBundleForm({ bundle, closeHref }: { bundle: BundleRecord; closeHref: string }) {
  const [state, formAction, pending] = useActionState<CatalogFormState, FormData>(updateBundleAction, { error: null });
  const [deactivateState, deactivateAction, deactivating] = useActionState<CatalogFormState, FormData>(setBundleActiveAction, { error: null });
  const [notes, setNotes] = useState(bundle.internalNotes ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <form action={formAction} className="sv-form">
        <input type="hidden" name="bundleId" value={bundle.id} />
        <input type="hidden" name="updatedAt" value={bundle.updatedAt.toISOString()} />
        <input type="hidden" name="returnTo" value={closeHref} />

        <label className="sv-field" htmlFor="sv-bundle-name">
          <span className="sv-label">Bundle Name *</span>
          <input id="sv-bundle-name" name="name" type="text" defaultValue={bundle.name} maxLength={100} required className="sv-input" />
        </label>

        <label className="sv-field" htmlFor="sv-bundle-price">
          <span className="sv-label">Price *</span>
          <input id="sv-bundle-price" name="priceDollars" type="number" min="0" step="0.01" defaultValue={(bundle.priceCents / 100).toString()} required className="sv-input" />
        </label>

        <label className="sv-field" htmlFor="sv-bundle-perks">
          <span className="sv-label">Perks (one per line)</span>
          <textarea id="sv-bundle-perks" name="perks" defaultValue={bundle.perks.join("\n")} rows={4} className="sv-textarea" />
        </label>

        <label className="sv-toggle">
          <input type="checkbox" name="active" defaultChecked={bundle.active} />
          <span>
            <strong>Active</strong>
            <br />
            <span className="sv-muted">Active in the admin catalog</span>
          </span>
        </label>

        <CatalogImageUploader entityId={bundle.id} images={bundle.images} requestUpload={requestBundleImageUploadAction} addImage={addBundleImageAction} removeImage={removeBundleImageAction} />

        <label className="sv-field" htmlFor="sv-bundle-notes">
          <span className="sv-label">Notes (Internal Only)</span>
          <textarea id="sv-bundle-notes" name="internalNotes" defaultValue={bundle.internalNotes ?? ""} maxLength={NOTES_MAX} rows={3} className="sv-textarea" onChange={(event) => setNotes(event.target.value)} />
          <span className="sv-counter">
            {notes.length}/{NOTES_MAX}
          </span>
        </label>

        {state.error && (
          <p role="alert" className="sv-error">
            {state.error}
          </p>
        )}

        <div className="sv-actions">
          <button type="button" className="admin-btn sv-btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete Bundle
          </button>
          <div className="sv-actions-right">
            <Link href={closeHref} replace scroll={false} className="admin-btn" data-variant="secondary">
              Cancel
            </Link>
            <button type="submit" className="admin-btn" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      {confirmingDelete && (
        <div className="sv-confirm" role="alertdialog" aria-label="Confirm delete bundle">
          <p>
            <strong>Delete {bundle.name}?</strong> This deactivates it in the admin catalog. It stays on past orders. The booking page doesn&apos;t use these settings yet. It can be
            reactivated later from its Active toggle.
          </p>
          {deactivateState.error && (
            <p role="alert" className="sv-error">
              {deactivateState.error}
            </p>
          )}
          <div className="sv-confirm-actions">
            <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
            <form action={deactivateAction}>
              <input type="hidden" name="bundleId" value={bundle.id} />
              <input type="hidden" name="active" value="false" />
              <input type="hidden" name="returnTo" value={closeHref} />
              <button type="submit" className="admin-btn sv-btn-danger" disabled={deactivating}>
                {deactivating ? "Deactivating…" : "Deactivate"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
