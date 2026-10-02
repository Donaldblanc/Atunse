"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { useActionState } from "react";
import { ITEM_STATUS_LABELS, type VisitPlan } from "@/features/orders/domain";
import "@/styles/admin-visit-completion.css";
import { completeVisitAction, type CompleteVisitState } from "./complete-visit-action";

/**
 * The Schedule Item dialog's "Mark as Completed", with what it will do to
 * the Order's pairs beforehand (`plan`) and what it did afterwards. It stays
 * mounted once the visit is completed, so the result outlives the refresh
 * that flips the dialog's status.
 */
export function CompleteVisitForm({
  appointmentId,
  scheduled,
  plan,
  pairLabels,
  rangeFields,
}: {
  appointmentId: string;
  scheduled: boolean;
  plan: VisitPlan;
  pairLabels: Record<string, string>;
  rangeFields: [string, string][];
}) {
  const [result, submit, pending] = useActionState(completeVisitAction, null);

  if (result?.alreadyCompleted) return <p className="vc-outcome">This visit was already completed.</p>;
  if (result) return <VisitOutcome heading="Pairs updated" plan={result} pairLabels={pairLabels} />;
  if (!scheduled) return null;
  return (
    <>
      {(plan.moves.length > 0 || plan.stays.length > 0) && <VisitOutcome heading="Completing this visit will" plan={plan} pairLabels={pairLabels} />}
      <form action={submit}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        {rangeFields.map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <button type="submit" className="admin-btn" disabled={pending}>
          <CheckCircleIcon size={18} aria-hidden="true" /> {pending ? "Saving…" : "Mark as Completed"}
        </button>
      </form>
    </>
  );
}

function VisitOutcome({ heading, plan, pairLabels }: { heading: string; plan: VisitPlan; pairLabels: Record<string, string> }) {
  const label = (itemId: string) => pairLabels[itemId] ?? "A pair";
  if (plan.moves.length === 0 && plan.stays.length === 0) return <p className="vc-outcome">No pairs needed moving.</p>;
  return (
    <div className="vc-outcome" role="status">
      <p className="vc-heading">{heading}</p>
      <ul className="vc-list">
        {plan.moves.map((move) => (
          <li key={move.itemId}>
            {label(move.itemId)}: {ITEM_STATUS_LABELS[move.from]} to {ITEM_STATUS_LABELS[move.to]}
          </li>
        ))}
        {plan.stays.map((stay) => (
          <li key={stay.itemId} className="vc-stay">
            {label(stay.itemId)}: stays at {ITEM_STATUS_LABELS[stay.status]}. {stay.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
