"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { ServiceRecord } from "./repositories/catalog-repository";
import { CATEGORY_LABELS } from "./catalog-labels";
import { addServiceImageAction, removeServiceImageAction, requestServiceImageUploadAction, setServiceActiveAction, updateServiceAction, type CatalogFormState } from "./catalog-actions";
import { CatalogImageUploader } from "./catalog-image-uploader";
import { SERVICE_CATEGORIES } from "./use-cases/update-catalog-item";

const DESCRIPTION_MAX = 500;
const NOTES_MAX = 500;

/** Edit Service: name, description, base price, suede upcharge, category, Active, images, internal notes. */
export function EditServiceForm({ service, closeHref }: { service: ServiceRecord; closeHref: string }) {
  const [state, formAction, pending] = useActionState<CatalogFormState, FormData>(updateServiceAction, { error: null });
  const [deactivateState, deactivateAction, deactivating] = useActionState<CatalogFormState, FormData>(setServiceActiveAction, { error: null });
  const [description, setDescription] = useState(service.description);
  const [notes, setNotes] = useState(service.internalNotes ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <form action={formAction} className="sv-form">
        <input type="hidden" name="serviceId" value={service.id} />
        <input type="hidden" name="updatedAt" value={service.updatedAt.toISOString()} />
        <input type="hidden" name="returnTo" value={closeHref} />

        <label className="sv-field" htmlFor="sv-name">
          <span className="sv-label">Service Name *</span>
          <input id="sv-name" name="name" type="text" defaultValue={service.name} maxLength={100} required className="sv-input" />
        </label>

        <label className="sv-field" htmlFor="sv-description">
          <span className="sv-label">Description *</span>
          <textarea
            id="sv-description"
            name="description"
            defaultValue={service.description}
            maxLength={DESCRIPTION_MAX}
            required
            rows={4}
            className="sv-textarea"
            onChange={(event) => setDescription(event.target.value)}
          />
          <span className="sv-counter">
            {description.length}/{DESCRIPTION_MAX}
          </span>
        </label>

        <div className="sv-grid-2">
          <label className="sv-field" htmlFor="sv-base">
            <span className="sv-label">Base Price *</span>
            <input id="sv-base" name="baseDollars" type="number" min="0" step="0.01" defaultValue={(service.baseCents / 100).toString()} required className="sv-input" />
          </label>
          <label className="sv-field" htmlFor="sv-suede">
            <span className="sv-label">Suede Upcharge</span>
            <input id="sv-suede" name="suedeDollars" type="number" min="0" step="0.01" defaultValue={(service.suedeFeeCents / 100).toString()} className="sv-input" />
            <span className="sv-hint">Additional charge for suede or delicate materials.</span>
          </label>
        </div>

        <label className="sv-field" htmlFor="sv-category">
          <span className="sv-label">Category *</span>
          <select id="sv-category" name="category" defaultValue={service.category} required className="sv-input">
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>

        <label className="sv-toggle">
          <input type="checkbox" name="active" defaultChecked={service.active} />
          <span>
            <strong>Active</strong>
            <br />
            <span className="sv-muted">Active in the admin catalog</span>
          </span>
        </label>

        <CatalogImageUploader entityId={service.id} images={service.images} requestUpload={requestServiceImageUploadAction} addImage={addServiceImageAction} removeImage={removeServiceImageAction} />

        <label className="sv-field" htmlFor="sv-notes">
          <span className="sv-label">Notes (Internal Only)</span>
          <textarea id="sv-notes" name="internalNotes" defaultValue={service.internalNotes ?? ""} maxLength={NOTES_MAX} rows={3} className="sv-textarea" onChange={(event) => setNotes(event.target.value)} />
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
            Delete Service
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
        <div className="sv-confirm" role="alertdialog" aria-label="Confirm delete service">
          <p>
            <strong>Delete {service.name}?</strong> This deactivates it in the admin catalog. It stays on past orders. The booking page doesn&apos;t use these settings yet. It can be
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
              <input type="hidden" name="serviceId" value={service.id} />
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
