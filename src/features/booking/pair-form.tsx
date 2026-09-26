"use client";

import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import type { PairDetails } from "./booking-types";

// Shared brand/material/notes/photos form, used by DetailsStep for both a
// single pair and each tab of a 3-pair bundle. Photos are required (at
// least one) — DetailsStep's Continue button checks details.photos.length
// before advancing.
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
            <option>Leather</option>
            <option>Suede</option>
            <option>Canvas</option>
            <option>Knit / Mesh</option>
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
            onClick={() => fileInputRef.current?.click()}
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
            accept="image/*"
            multiple
            hidden
            onChange={(e) => onChange({ ...details, photos: Array.from(e.target.files ?? []) })}
          />
        </div>
      </div>
    </>
  );
}
