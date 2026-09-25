import { ArrowRight } from "lucide-react";
import { PairForm } from "./pair-form";
import type { PairDetails } from "./booking-types";

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
  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 2 OF 4</p>
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

      <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={onContinue}>
        Continue to schedule
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}
