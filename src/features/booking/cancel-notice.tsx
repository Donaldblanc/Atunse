import Link from "next/link";
import { CANCEL_PROMPT } from "@/features/orders/cancel-notice";

/**
 * How to cancel or close an account: email the shop. `email` is the
 * server's CONTACT_EMAIL, passed down from the booking page; without one
 * we point at the contact form.
 */
export function CancelNotice({ email }: { email: string | null }) {
  return (
    <p className="booking-page-terms">
      {CANCEL_PROMPT}{" "}
      {email ? (
        <>
          Email us at <a href={`mailto:${email}`}>{email}</a>.
        </>
      ) : (
        <>
          Use our <Link href="/contact">contact form</Link>.
        </>
      )}
    </p>
  );
}
