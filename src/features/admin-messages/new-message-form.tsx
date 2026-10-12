"use client";

import { useActionState } from "react";
import { startConversationAction, type StartConversationState } from "./messages-actions";

/** The New Message dialog's form: starts a Conversation with an existing Customer Account. */
export function NewMessageForm({ initialKey }: { initialKey: string }) {
  const [state, formAction, pending] = useActionState<StartConversationState, FormData>(startConversationAction, { error: null });

  return (
    <form action={formAction} className="am-new-message-form">
      <input type="hidden" name="idempotencyKey" value={initialKey} />
      <label htmlFor="am-customer-email" className="oe-label">
        Customer email
      </label>
      <input id="am-customer-email" name="customerEmail" type="email" required maxLength={254} className="oe-input" placeholder="customer@example.com" />

      <label htmlFor="am-subject" className="oe-label">
        Subject (optional)
      </label>
      <input id="am-subject" name="subject" type="text" maxLength={200} className="oe-input" />

      <label htmlFor="am-body" className="oe-label">
        Message
      </label>
      <textarea id="am-body" name="body" rows={4} required maxLength={5000} className="oe-input" />

      {state.error && (
        <p role="alert" className="od-status-error">
          {state.error}
        </p>
      )}

      <button type="submit" className="admin-btn" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
