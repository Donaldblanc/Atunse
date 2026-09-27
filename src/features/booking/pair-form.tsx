"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, TriangleAlert, X } from "lucide-react";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM } from "@/features/orders/photo-keys";
import { catalogService, formatServicePrice, MATERIALS } from "@/features/orders/service-catalog";
import { PHOTO_ACCEPT, selectPhotos, skippedMessage } from "./photo-selection";
import type { PairDetails } from "./booking-types";
import { ServiceRow } from "./service-row";
import { BOOKING_ADD_ONS } from "./services-data";

// Shared brand/material/notes/photos/add-ons form, used by DetailsStep for
// both a single pair and each tab of a 3-pair bundle, so each pair picks
// its own optional Add-ons. Photos are required (at
// least one) — DetailsStep's Continue button checks details.photos.length
// before advancing. Picked photos are filtered against the server's limits
// (photo-selection.ts) and each can be removed.
export function PairForm({
  pairLabel,
  brandPlaceholder,
  details,
  onChange,
}: {
  pairLabel?: string;
  brandPlaceholder: string;
  details: PairDetails;
  onChange: (details: PairDetails) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [skipped, setSkipped] = useState<string | null>(null);

  function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { photos, skipped } = selectPhotos(details.photos, Array.from(files));
    setSkipped(skippedMessage(skipped));
    onChange({ ...details, photos });
  }

  function toggleAddOn(id: string) {
    const addOnIds = details.addOnIds.includes(id) ? details.addOnIds.filter((existing) => existing !== id) : [...details.addOnIds, id];
    onChange({ ...details, addOnIds });
  }

  function removePhoto(index: number) {
    setSkipped(null);
    onChange({ ...details, photos: details.photos.filter((_, i) => i !== index) });
  }

  return (
    <>
      {pairLabel && (
        <div className="booking-page-section-head booking-page-section-head-tight">
          <h3>{pairLabel}</h3>
        </div>
      )}
      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Brand / Model</span>
          <input
            type="text"
            placeholder={brandPlaceholder}
            value={details.brand}
            onChange={(e) => onChange({ ...details, brand: e.target.value })}
          />
        </label>
        <label className="booking-page-field">
          <span>Material (optional)</span>
          <select value={details.material} onChange={(e) => onChange({ ...details, material: e.target.value })}>
            <option value="" disabled>
              Select material
            </option>
            {MATERIALS.map((material) => (
              <option key={material}>{material}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Additional notes (optional)</span>
          <textarea
            maxLength={500}
            value={details.notes}
            onChange={(e) => onChange({ ...details, notes: e.target.value })}
            placeholder="Tell us anything we should know..."
          />
          <span className="booking-page-char-count">{details.notes.length}/500</span>
        </label>
        <div className="booking-page-field">
          <span>Upload photos (required)</span>
          <button
            type="button"
            className="booking-page-dropzone"
            data-drag-over={isDragOver}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              addPhotos(e.dataTransfer.files);
            }}
          >
            <ImagePlus size={22} aria-hidden="true" />
            <span>
              {details.photos.length > 0
                ? `${details.photos.length} photo${details.photos.length === 1 ? "" : "s"} selected`
                : "Drag & drop photos here or click to upload"}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="booking-page-field-caption">
            JPEG, PNG, WebP or HEIC, up to {MAX_PHOTOS_PER_ITEM} photos, {MAX_PHOTO_BYTES / 1024 / 1024} MB each.
          </span>
          {details.photos.length > 0 && (
            <ul className="booking-page-photo-list">
              {details.photos.map((photo, index) => (
                <PhotoThumb key={`${photo.name}-${photo.lastModified}-${index}`} photo={photo} onRemove={() => removePhoto(index)} />
              ))}
            </ul>
          )}
          <p className="booking-page-form-warning" role="status" aria-live="polite">
            {skipped && (
              <>
                <TriangleAlert size={14} aria-hidden="true" />
                {skipped}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="booking-page-addons">
        <p className="booking-page-service-group-label">Additional services (optional)</p>
        <div className="booking-page-service-list">
          {BOOKING_ADD_ONS.map((addOn) => (
            <ServiceRow
              key={addOn.id}
              Icon={addOn.icon}
              name={addOn.name}
              subtitle={addOn.description}
              price={formatServicePrice(catalogService(addOn.id))}
              shape="checkbox"
              isActive={details.addOnIds.includes(addOn.id)}
              onClick={() => toggleAddOn(addOn.id)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function PhotoThumb({ photo, onRemove }: { photo: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  // Object URLs hold the file in memory until revoked.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is created here so the cleanup can revoke it
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  return (
    <li className="booking-page-photo-item">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing for next/image to optimize */}
      {url ? <img src={url} alt="" /> : <span className="booking-page-photo-placeholder" aria-hidden="true" />}
      <span className="booking-page-photo-name">{photo.name}</span>
      <button type="button" className="booking-page-photo-remove" onClick={onRemove} aria-label={`Remove ${photo.name}`}>
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
