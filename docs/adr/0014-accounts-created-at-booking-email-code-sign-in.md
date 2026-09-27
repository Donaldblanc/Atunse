# 0014. Every booking belongs to an Account; customers sign in with emailed codes

## Status
Accepted (2026-09-27). Supersedes the Guest Order and Account Linking model in `CONTEXT.md`. Refines ADR-0005's interim auth for customers; admins keep the ADR-0005 addendum's password login.

## Context
Booking originally allowed guest Orders (no Account), with Account Linking
to claim them later. The owner decided that every booking should create or
use a Customer Account (email and phone required), and that customers must
only ever see their own photos, while nobody signed out can see any.
Customer login uses one-time email codes, and for now it appears only in
the booking flow, when a booking's email already has an Account.

## Decision
- **No guest orders.** `orders.accountId` is required, and always points at a **Customer** Account. A signed-out booking creates one (lowercased email, phone) in the same transaction as the Order.
- **Admins and customers are separate identities.** Account emails are unique per role (`@@unique([email, role])`), so the same person can have an Admin Account and a Customer Account. An admin's email books like any other, into its own Customer Account; Orders never attach to an Admin Account. The two logins are separate too:
  - admins use the password login and the `atunse_session` cookie;
  - customers use email codes and the `atunse_customer_session` cookie.

  The booking flow reads only the customer cookie, so a signed-in admin goes through it as a signed-out customer.
- **Owner resolution is the use-case's policy** (`resolveOwner` in `submitOrder`). The repository only connects an existing Account or creates a new one, and reports `EmailTakenError` when a concurrent first booking won the unique index, in which case the owner is resolved again. Resolution rules:
  - **Signed-in customer, their own email:** their Account.
  - **Signed-in customer, a different email** (e.g. a shared browser): the session is ignored and the booking is treated as signed out, so it can't land in the wrong person's Account.
  - **Signed out, new email:** a new Customer Account.
  - **Signed out, email with a Customer Account:** `409 SIGN_IN_REQUIRED`. The booking flow shows its own customer login screen (separate from the admin `/sign-in`) and finishes the booking once the customer signs in.
- **Email sign-in codes** for Customer Accounts, behind one `SignInCodes` module (`issue`, `redeem`) that owns the whole lifecycle:
  - **Storage and lifetime:** 6 digits, stored only as an HMAC keyed by `SESSION_SECRET`. A code is valid for 10 minutes and works once, and only the latest code counts.
  - **Limits:** 5 guesses per code, enforced atomically in the database. 5 codes per 15 minutes, and **20 guesses per day** per account, so the per-window limits can't be cycled indefinitely.
  - **No probing:** unknown emails, Admin-only emails and rate-limited accounts all get the same silent `202`.
- **Photos only through authorized, short-lived links.** The bucket stays private. `GET /api/v1/orders/:orderId/photos` issues 5-minute presigned GET links:
  - an Admin (admin session) can get any Order's;
  - a Customer (customer session) only their own Account's;
  - anyone else gets `404` (no probing), or `401` when signed out.

  Photo keys live in `item_photos` with a unique `key`, so a photo belongs to exactly one Item. Two concurrent bookings can't both claim a key, and quoting someone else's key never grants view access.
- **Behind a feature toggle.** `FEATURE_CUSTOMER_SIGN_IN_ENABLED` (env-only, off by default) gates customer login. While it's off, the code routes answer 404, customers can't view photos, and a signed-out booking with an existing email attaches to that Account. That's safe because no customer can sign in to see anything. Account creation on booking is always on.
- **Email delivery through Resend** (ADR-0006) when `RESEND_API_KEY` and `EMAIL_FROM` are set, otherwise the console logger. **Fail closed in production:** the code routes answer `503` there without Resend, and the console logger never writes subjects (which carry codes) to production logs.

## Consequences
- Account Linking is gone: there are no guest Orders left to link. The migration gave every existing account-less Order a Customer Account, one per email, including orders placed with an admin's email.
- The Order keeps `contactName/contactEmail/contactPhone` as a per-booking snapshot. The Account is the owner; the contact fields are how the shop reaches the customer about this booking.
- The booking endpoint reveals whether an email has an Account (the 409). That's inherent to "prompt existing emails to log in", and it only confirms what a sign-in attempt would.
- An admin who books is a customer for that booking; to see their own bookings as a customer, they sign in with a code like anyone else.
- Still to come: a customer-facing "my bookings" page that uses the photo endpoint, moving admins to email codes once Resend is live, and choosing a managed provider (ADR-0005), which would replace the code routes behind the same session and acting-user seam.
