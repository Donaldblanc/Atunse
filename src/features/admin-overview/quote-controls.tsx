"use client";

import { useActionState, useState } from "react";
import { Money } from "@/shared/money/money";
import { centsToPriceField, parseQuotePrice } from "./quote-price";
import { recordApprovalAction, sendQuoteAction, type QuoteStepState } from "./quote-actions";

const IDLE: QuoteStepState = { error: null, notice: null };

/**
 * The two Approval Gate steps for one pair (ADR-0001): Send Quote while it's
 * Under Review, then "Customer approved" once it's Quote Sent. Both email or
 * record something real, so each takes a second, explicit click that says
 * what will happen. One component per pair (keyed by the pair, not its
 * status), so the "Quote sent" result stays on screen after the pair moves
 * on to its approval step.
 */
export function PairQuoteControls({
  itemId,
  status,
  estimateCents,
  quotedCents,
  customerEmail,
  quoteKey,
  approvalKey,
  pairLabel,
}: {
  itemId: string;
  status: "UNDER_REVIEW" | "QUOTE_SENT";
  estimateCents: number;
  quotedCents: number | null;
  customerEmail: string;
  /** Made when the dialog rendered, so a double submit applies once (ADR-0012). */
  quoteKey: string;
  approvalKey: string;
  /** Names the pair when the Order has several; null for a single pair. */
  pairLabel: string | null;
}) {
  const [quoteState, quoteAction, quoting] = useActionState(sendQuoteAction, IDLE);
  const [approvalState, approvalAction, approving] = useActionState(recordApprovalAction, IDLE);
  const [price, setPrice] = useState(centsToPriceField(estimateCents));
  const [confirmingQuote, setConfirmingQuote] = useState(false);
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const parsed = parseQuotePrice(price);
  const [checked, setChecked] = useState(false);
  const inputError = checked && !parsed.ok ? parsed.error : null;
  const message = [approvalState, quoteState].find((state) => state.error || state.notice);

  return (
    <div className="od-quote">
      {pairLabel && <p className="od-status-pair">{pairLabel}</p>}

      {status === "UNDER_REVIEW" && (
        <form action={quoteAction} className="od-quote-form">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="idempotencyKey" value={quoteKey} />
          <label className="od-quote-field">
            <span>Final price for this pair</span>
            <span className="od-quote-input">
              <span aria-hidden="true">$</span>
              <input
                name="price"
                inputMode="decimal"
                autoComplete="off"
                value={price}
                readOnly={confirmingQuote}
                aria-invalid={inputError ? true : undefined}
                aria-describedby={inputError ? `${itemId}-price-error` : undefined}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setChecked(false);
                }}
              />
            </span>
          </label>
          <p className="od-muted">Estimate was {Money.fromCents(estimateCents).format()}. The customer sees this price the moment you send it.</p>
          {inputError && (
            <p id={`${itemId}-price-error`} role="alert" className="od-status-error">
              {inputError}
            </p>
          )}
          {confirmingQuote && parsed.ok ? (
            <>
              <p className="od-quote-confirm">
                Email {customerEmail} a quote of <strong>{Money.fromCents(parsed.cents).format()}</strong>
                {parsed.cents !== estimateCents &&
                  ` (${Money.fromCents(Math.abs(parsed.cents - estimateCents)).format()} ${parsed.cents > estimateCents ? "above" : "below"} the estimate)`}
                ?
              </p>
              <div className="od-status-actions">
                <button key="send-quote" type="submit" className="admin-btn" disabled={quoting}>
                  Send quote
                </button>
                <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirmingQuote(false)} disabled={quoting}>
                  Edit price
                </button>
              </div>
            </>
          ) : (
            <div className="od-status-actions">
              <button
                key="review-quote"
                type="button"
                className="admin-btn"
                onClick={() => {
                  setChecked(true);
                  if (parsed.ok) setConfirmingQuote(true);
                }}
              >
                Review quote
              </button>
            </div>
          )}
        </form>
      )}

      {status === "QUOTE_SENT" && (
        <form action={approvalAction} className="od-quote-form">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="idempotencyKey" value={approvalKey} />
          <p className="od-muted">
            Quoted {quotedCents === null ? "" : Money.fromCents(quotedCents).format()}. When the customer says yes (text, call or email reply), record it here.
          </p>
          {confirmingApproval ? (
            <>
              <p className="od-quote-confirm">Record that the customer approved this quote? It can&apos;t be undone.</p>
              <div className="od-status-actions">
                <button key="record-approval" type="submit" className="admin-btn" disabled={approving}>
                  Confirm approval
                </button>
                <button type="button" className="admin-btn" data-variant="secondary" onClick={() => setConfirmingApproval(false)} disabled={approving}>
                  Not yet
                </button>
              </div>
            </>
          ) : (
            <div className="od-status-actions">
              <button key="ask-approval" type="button" className="admin-btn" onClick={() => setConfirmingApproval(true)}>
                Customer approved
              </button>
            </div>
          )}
        </form>
      )}

      {message?.error && (
        <p role="alert" className="od-status-error">
          {message.error}
        </p>
      )}
      {message?.notice && !message.error && (
        <p role="status" className="od-quote-notice">
          {message.notice}
        </p>
      )}
    </div>
  );
}
