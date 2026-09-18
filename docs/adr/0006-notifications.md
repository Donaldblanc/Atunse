# 0006. Notification providers and triggering model

## Status
Accepted

## Context
Both email and SMS are required, triggered off many points in the Item
Status Pipeline and payment flow (submission, quote ready, approval needed,
deposit received, sneakers received, status changes, completion, ready for
pickup/shipping, tracking available, plus reminders). Notifications need a
provider adapter (per ADR-0003) and a decision on how status-change
use-cases actually trigger them.

## Decision
**Providers:** Resend for transactional email (permanent free tier — 3,000
emails/month, no credit card required — chosen over Postmark/SendGrid for
the better free-tier ceiling). SMS has no genuinely free provider at any
volume (Twilio/Vonage/Telnyx trial credit only sends to verified numbers,
which doesn't work for real customers) — see ADR-0009 for how SMS is
deferred. Both channels sit behind the same third-party adapter seam as
storage (ADR-0004) and payments (TODO/Stripe) — a `NotificationService`
interface, swappable implementation, so Resend or the eventual SMS provider
can be swapped without touching use-case code.

**Triggering — outbox, not events, for now:**
- Status-change use-cases call `NotificationService` directly (e.g. `ApproveItem` calls `notify.send(...)`), same transaction/request as the state change.
- Delivery itself goes through a database-backed **outbox/job table**: the use-case writes a "send this notification" row in the same DB transaction as the state change, and a separate worker/poller actually calls Postmark/Twilio and marks the row sent/failed/retried. This decouples "did we record the intent to notify" (transactionally safe, never lost) from "did the provider actually deliver it" (can retry, can be slow, can fail) — without standing up a full message queue.
- **Explicit domain events (e.g. `ItemApproved`, `DepositReceived`) are deferred** until a second independent consumer of the same business fact actually exists — e.g. audit logging, analytics, or search indexing alongside notifications. Introducing an event bus solely to make the one notification call "more abstract" is not justified yet; the outbox already provides the reliability that would otherwise be the excuse for events.

## Consequences
- Simpler than a full event-driven architecture, but still durable — a crashed process or a Postmark/Twilio outage doesn't silently drop a notification, because the intent is already committed to the DB before delivery is attempted.
- Requires a small worker/poller process (or scheduled job) to drain the outbox table — more than "just call the API," less than a message broker.
- If a second consumer of the same business facts shows up later (analytics, audit trail), promote the outbox write into a proper domain event at that point rather than retrofitting from scratch — the outbox's row-per-fact shape maps directly onto that.
