"use client";

import { useActionState, useState } from "react";
import { REPLY_MAX_LENGTH } from "@/features/messages/reply-limits";
import { replyToConversationAction, type ReplyState } from "./message-actions";

/**
 * Reply to one Conversation. The text is controlled so a failed send keeps
 * what was typed and a successful one clears it; each success also takes a
 * fresh idempotency key so the next reply isn't mistaken for a replay.
 */
export function MessageReplyForm({ conversationId, initialKey }: { conversationId: string; initialKey: string }) {
  const [body, setBody] = useState("");
  const [key, setKey] = useState(initialKey);
  const [state, formAction, pending] = useActionState<ReplyState, FormData>(
    async (previous, formData) => {
      const next = await replyToConversationAction(previous, formData);
      if (next.sent > previous.sent) {
        setBody("");
        setKey(crypto.randomUUID());
      }
      return next;
    },
    { error: null, notice: null, sent: 0 },
  );
  const fieldId = `msg-reply-${conversationId}`;

  return (
    <form action={formAction} className="msg-reply">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <label htmlFor={fieldId} className="oe-label">
        Reply by email
      </label>
      <textarea
        id={fieldId}
        name="body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={REPLY_MAX_LENGTH}
        aria-invalid={state.error ? true : undefined}
        className="oe-input"
      />
      {state.error && (
        <p role="alert" className="od-status-error">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="msg-notice" data-warn={state.notice.includes("didn't go out") ? "true" : undefined}>
          {state.notice}
        </p>
      )}
      <button type="submit" className="admin-btn" disabled={pending || body.trim() === ""}>
        {pending ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}
