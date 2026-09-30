"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { PAIR_DETAIL_FIELDS, PAIR_DETAIL_MAX, pairFieldKey, type PairDetailField } from "@/features/orders/order-details";
import type { OrderEditValues } from "./order-detail";
import { updateOrderDetailsAction, type EditOrderState } from "./order-edit-actions";

const PAIR_FIELD_LABELS: Record<PairDetailField, string> = {
  brand: "Brand",
  model: "Model",
  size: "Size",
  colorway: "Colorway",
  material: "Material",
  condition: "Condition",
  description: "Description",
};

const CONTACT_INPUTS = [
  { name: "contactName", label: "Name", maxLength: 120, span: 2 },
  { name: "contactEmail", label: "Email", type: "email", inputMode: "email", maxLength: 254 },
  { name: "contactPhone", label: "Phone", type: "tel", inputMode: "tel", maxLength: 30 },
  { name: "line1", label: "Street address", maxLength: 120, span: 2 },
  { name: "line2", label: "Apt, suite (optional)", maxLength: 120, span: 2, optional: true },
  { name: "city", label: "City", maxLength: 80 },
  { name: "state", label: "State", maxLength: 2 },
  { name: "zip", label: "Zip", inputMode: "numeric", maxLength: 10 },
] as const;

/**
 * Edit Order: the customer's contact and address, then one fieldset per
 * pair, saved by one server action. Cancel and a successful save both go
 * back to the plain Order dialog (`viewHref`). Errors show under their field.
 *
 * Inputs are controlled: React resets a form's uncontrolled fields after
 * its action runs, which would wipe the admin's edits on a validation error.
 *
 * Fulfillment method, dates, price, services and status aren't here on
 * purpose (rescheduling and money have their own flows). The email is this
 * Order's contact copy; the customer's sign-in email is separate (ADR-0014).
 */
export function OrderEditForm({
  orderId,
  values,
  viewHref,
  idempotencyKey,
}: {
  orderId: string;
  values: OrderEditValues;
  viewHref: string;
  /** Made when the dialog rendered, so a double submit applies once (ADR-0012). */
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState<EditOrderState, FormData>(updateOrderDetailsAction, { error: null, errors: {}, saved: false });
  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(CONTACT_INPUTS.map(({ name }) => [name, values[name]])),
    ...Object.fromEntries(values.pairs.flatMap((pair) => PAIR_DETAIL_FIELDS.map((field) => [`${pair.itemId}:${field}`, pair[field]]))),
  }));
  const router = useRouter();
  useEffect(() => {
    if (state.saved) router.replace(viewHref, { scroll: false });
  }, [state.saved, viewHref, router]);

  const { errors } = state;
  const bind = (name: string, errorKey: string, maxLength: number) => ({
    id: `oe-${name}`,
    name,
    value: draft[name] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((current) => ({ ...current, [name]: event.target.value })),
    maxLength,
    autoComplete: "off",
    "aria-invalid": errors[errorKey] ? true : undefined,
    "aria-describedby": errors[errorKey] ? `oe-${name}-error` : undefined,
    className: "oe-input",
  });

  return (
    <form action={formAction} className="oe-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="updatedAt" value={values.updatedAt} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <fieldset className="ov-card od-card oe-set">
        <legend className="ov-card-title">Contact &amp; address</legend>
        <p className="od-muted oe-hint">
          Where DJ collects and returns a Local Drop-Off pair, or the return address for a Mail-In. The email is only this order&apos;s contact copy; the customer&apos;s sign-in email doesn&apos;t change.
        </p>
        <div className="oe-grid">
          {CONTACT_INPUTS.map((input) => (
            <Field key={input.name} name={input.name} label={input.label} error={errors[input.name]} span={"span" in input ? input.span : undefined}>
              <input {...bind(input.name, input.name, input.maxLength)} type={"type" in input ? input.type : "text"} inputMode={"inputMode" in input ? input.inputMode : undefined} required={!("optional" in input)} />
            </Field>
          ))}
        </div>
      </fieldset>

      {values.pairs.map((pair) => (
        <fieldset key={pair.itemId} className="ov-card od-card oe-set">
          <legend className="ov-card-title">{pair.label} details</legend>
          <input type="hidden" name="itemId" value={pair.itemId} />
          <div className="oe-grid">
            {PAIR_DETAIL_FIELDS.map((name) => {
              const inputName = `${pair.itemId}:${name}`;
              const props = bind(inputName, pairFieldKey(pair.itemId, name), PAIR_DETAIL_MAX[name]);
              return (
                <Field key={name} name={inputName} label={PAIR_FIELD_LABELS[name]} error={errors[pairFieldKey(pair.itemId, name)]} span={name === "description" ? 2 : undefined}>
                  {name === "description" ? <textarea {...props} rows={3} /> : <input {...props} type="text" />}
                </Field>
              );
            })}
          </div>
        </fieldset>
      ))}

      {state.error && (
        <p role="alert" className="od-status-error">
          {state.error}
        </p>
      )}
      <div className="oe-actions">
        <Link href={viewHref} replace scroll={false} className="admin-btn" data-variant="secondary">
          Cancel
        </Link>
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({ name, label, error, span, children }: { name: string; label: string; error: string | undefined; span?: 2; children: React.ReactNode }) {
  return (
    <div className="oe-field" data-span={span}>
      <label htmlFor={`oe-${name}`} className="oe-label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`oe-${name}-error`} role="alert" className="od-status-error oe-error">
          {error}
        </p>
      )}
    </div>
  );
}
