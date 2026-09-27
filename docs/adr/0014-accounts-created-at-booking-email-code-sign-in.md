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
- **No guest orders.** `orders.accountId` is required. A signed-out booking creates a Customer Account (lowercased email, phone) in the same transaction as the Order. A signed-in Customer's booking goes into their own Account.
- **An existing email must sign in.** A signed-out booking whose email already has an Account gets `409 SIGN_IN_REQUIRED`. The booking flow then shows its own customer login screen (separate from the admin `/sign-in`) and finishes the booking once the customer signs in. Booking never attaches an Order to an existing Account without proof of the email.
- **Email sign-in codes** for Customer Accounts: 6 digits, stored only as an HMAC (keyed by `SESSION_SECRET`), valid for 10 minutes, single use. Only the latest code counts. 5 guesses per code (enforced atomically in the database), 5 codes per 15 minutes per Account. Unknown emails and Admin Accounts get the same silent success, so the endpoint can't probe emails. A valid code sets the same signed session cookie admins use, with role `CUSTOMER`.
- **Photos only through authorized, short-lived links.** The bucket stays private. `GET /api/v1/orders/:orderId/photos` issues 5-minute presigned GET links: an Admin can get any Order's, a Customer only their own Account's. Anyone else gets `404` (no probing) or `401` when signed out. A photo key can be attached to only one Order, so quoting someone else's key never grants view access.
- **Behind a feature toggle.** `FEATURE_CUSTOMER_SIGN_IN_ENABLED` (env-only, off by default) gates customer login. While it's off, the code routes answer 404, customers can't view photos, and a signed-out booking with an existing email attaches to that Account. That's safe because no customer can sign in to see anything. Account creation on booking is always on.
- **Email delivery through Resend** (ADR-0006) when `RESEND_API_KEY` and `EMAIL_FROM` are set, otherwise the console logger. The toggle should only be turned on once Resend is live, or customers can't receive their codes.

## Consequences
- Account Linking is gone: there are no guest Orders left to link. The migration gave every existing account-less Order a Customer Account, one per email.
- The Order keeps `contactName/contactEmail/contactPhone` as a per-booking snapshot. The Account is the owner; the contact fields are how the shop reaches the customer about this booking.
- The booking endpoint reveals whether an email has an Account (the 409). That's inherent to "prompt existing emails to log in", and it only confirms what a sign-in attempt would.
- Admin sessions can't book (403); admins sign out to book as a customer.
- Still to come: a customer-facing "my bookings" page that uses the photo endpoint, moving admins to email codes once Resend is live, and choosing a managed provider (ADR-0005), which would replace the code routes behind the same session and acting-user seam.
