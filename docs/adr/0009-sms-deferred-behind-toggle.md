# 0009. SMS deferred behind a feature toggle; email-only for MVP notifications

## Status
Accepted

## Context
The original notification requirement is both email and SMS on every
status-relevant event. No SMS provider (Twilio, Vonage, Telnyx, etc.) has a
real free tier — trial accounts can only send to phone numbers the account
owner has manually verified, which is unusable for real customers. The
business wants a genuinely-free-tier MVP.

## Decision
Ship MVP notifications as **email-only** (Resend, ADR-0006). Build the
`NotificationService` adapter to support an SMS channel from day one (same
adapter interface, same outbox mechanism per ADR-0006) but gate actually
sending SMS behind a feature toggle, off by default — the same pattern as
the Stripe toggle (see TODO). Every event that should eventually trigger
SMS already triggers the equivalent email; turning the toggle on later is
additive, not a redesign.

## Consequences
- No SMS provider cost or trial-account limitation blocks MVP launch.
- Customers only get email updates at first — acceptable given the original ask was "email or SMS or both," and email covers every required event.
- When there's budget to pay for real SMS sending, flipping the toggle on (plus wiring a real Twilio/etc. account) is the only remaining work — no notification-triggering logic needs to change.
- Tracked in [docs/TODO.md](../TODO.md) alongside the Stripe toggle.
