"use client";

import { useState } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { PairForm } from "./pair-form";
import type { PairDetails } from "./booking-types";
import { formatList } from "./format-list";

export function DetailsStep({
  isBundle,
  activePair,
  onSelectPair,
  singlePair,
  onChangeSinglePair,
  pairs,
  onChangePair,
  onContinue,
}: {
  isBundle: boolean;
  activePair: number;
  onSelectPair: (index: number) => void;
  singlePair: PairDetails;
  onChangeSinglePair: (details: PairDetails) => void;
  pairs: PairDetails[];
  onChangePair: (index: number, details: PairDetails) => void;
  onContinue: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const missingPairs = isBundle
    ? pairs.map((pair, i) => (pair.photos.length === 0 ? i + 1 : null)).filter((n): n is number => n !== null)
    : [];
  const photosMet = isBundle ? missingPairs.length === 0 : singlePair.photos.length > 0;
  const missingMessage = isBundle
    ? `Upload at least one photo for Pair${missingPairs.length > 1 ? "s" : ""} ${formatList(missingPairs.map(String))} to continue.`
    : "Upload at least one photo to continue.";
  const showWarning = attempted && !photosMet;

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 2 OF 5</p>
        <h2>Tell us about your pair{isBundle ? "s" : ""}.</h2>
        <p>Help us give you the best care possible.</p>
      </div>

      {isBundle ? (
        <>
          <div className="booking-page-pair-tabs">
            {[0, 1, 2].map((index) => (
              <button type="button" key={index} data-active={activePair === index} onClick={() => onSelectPair(index)}>
                Pair {index + 1}
              </button>
            ))}
          </div>
          <PairForm
            pairLabel={`Pair details (${activePair + 1} of 3)`}
            brandPlaceholder="e.g. Nike Air Jordan 1"
            details={pairs[activePair]!}
            onChange={(details) => onChangePair(activePair, details)}
          />
        </>
      ) : (
        <PairForm brandPlaceholder="e.g. Nike Air Force 1" details={singlePair} onChange={onChangeSinglePair} />
      )}

      <button
        type="button"
        className="landing-btn-primary booking-page-continue-btn"
        onClick={() => {
          if (!photosMet) {
            setAttempted(true);
            return;
          }
          onContinue();
        }}
        aria-describedby={showWarning ? "details-step-warning" : undefined}
      >
        Continue to schedule
        <ArrowRight size={14} aria-hidden="true" />
      </button>
      {showWarning && (
        <p className="booking-page-form-warning" id="details-step-warning" role="status" aria-live="polite">
          <TriangleAlert size={14} aria-hidden="true" />
          {missingMessage}
        </p>
      )}
    </>
  );
}
