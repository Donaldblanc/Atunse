# Atunṣe / RestoredByDJ — Domain Glossary

This is a glossary of domain terms, not a spec. No implementation details.

## Order
The billing and shipping envelope a customer submits. Every Order belongs to a **Customer Account**. An Order is a **container**: it holds one or more Items and carries the customer's contact info for this booking, **Fulfillment Method** (Pickup or Mail-In), shipping address, and payment/deposit records. An Order has no status of its own — its displayed status is a rollup derived from its Items' statuses (e.g. "least-advanced item" or an explicit summary like "2 of 3 items in progress").

## Item
One **pair** of sneakers submitted within an Order (not one individual shoe — left/right are never priced or tracked separately). An Item carries its own brand/model, condition photos, requested Services, price, and **its own status** through the restoration Status Pipeline. Items in the same Order advance independently — one Item can be In Progress while a sibling Item in the same Order is still Under Review awaiting approval.

## Order Status (display)
There is no single Order status field. The customer-facing order view always shows a per-Item breakdown (each Item's own place in the Status Pipeline) — never a single collapsed label for the whole Order.

## Policy Acceptance
Two required parts, presented once, at the final review-and-submit step of order creation, before the Deposit is charged:
- **Pricing & Restoration Acknowledgments** — four risk acknowledgments, each its own checkbox: final pricing is determined after inspection (additional charges need the customer's approval first); results may vary; restoration involves inherent material risks; restoration doesn't guarantee structural or performance restoration. They record that the customer understood each risk. None of them, alone or together, is acceptance of the contract.
- **Terms Agreement** — one checkbox: "I have read and agree to the Terms of Service & Restoration Agreement and acknowledge the restoration risks described above." This is the contractual acceptance. The **Terms of Service & Restoration Agreement** is a PDF, linked from the checkbox.

No box is ever pre-checked, and no Order is submitted without every acknowledgment and the Terms Agreement. No per-policy contextual acceptance elsewhere in the flow. Each Order keeps its **Terms Acceptance** as evidence: when it was accepted, which agreement version (its permanent URL and the PDF's SHA-256), and each acknowledgment — see [ADR-0015](docs/adr/0015-terms-acceptance-evidence.md).

## Balance Delta
The difference between an Item's final price (set when its Quote is sent) and the rough estimate its share of the Deposit was based on. Handled by adjusting the Balance due at completion — the Deposit already paid is never re-charged or refunded for this; the customer is notified of the real total the moment the Quote is sent (not held back until pickup).

## Service
A unit of cleaning or restoration work that can be attached to an Item: Standard Clean, Premium Clean, Oxidation Restoration, Sneaker Painting & Dyeing, or Reglue. An Item can have multiple Services attached, but at most one cleaning tier (Standard or Premium, never both). Restoration Services combine freely with each other and with the cleaning tier.

## Add-on
An optional extra Service on one pair, on top of its main Service: Lace Replacement, Premium Deodorizing Treatment, or Waterproof Seal. Flat-priced, with no Suede Fee. Never booked on its own: an Item needs at least one cleaning or restoration Service before it can take an Add-on. Chosen per pair, Bundle pairs included (e.g. new laces on one pair of three). _Avoid_: calling restoration Services "add-ons".

## Bundle
A fixed-price package of Services covering three pairs booked together. Each pair in a Bundle is still its own Item.
Every pair gets Premium Clean; the Bundle's perks that cover only some pairs (e.g. "Oxidation touch-up on 1 pair") are assigned by the shop after inspection, so the Order records which Bundle was bought. The Bundle price is split evenly across its three Items (any leftover cent on the first), and each Item adds its own **Add-ons** on top, so the Items always sum to the Bundle price plus its Add-ons.

## Rush
An optional faster turnaround a customer can request for a flat extra fee.

## Suede Fee
A flat surcharge on a cleaning Service when the pair's material is suede. Waived in Bundles.

## Deposit
A single payment equal to 50% of the sum of all Items' prices in an Order, charged once at submission — using each Item's published starting price where standard, and a rough estimate for Items pending a custom quote. The Balance (remaining 50%, plus any delta once custom-quoted Items are finalized) is reconciled and collected before completion/return.

## Status Pipeline
The sequence an **Item** (not the Order) moves through: Request Submitted → Under Review → Quote Sent → Approved → Awaiting Sneakers → In Progress → Quality Check → Ready for Pickup/Shipping → Completed. Cancelled is reachable from any state.

## Approval Gate
Every Item, with no exceptions, must be reviewed and priced by the owner before the customer can pay/proceed on that Item. There is no auto-priced "standard" tier in the MVP — see [ADR-0001](docs/adr/0001-manual-review-every-item.md). The Approval Gate is therefore not conditional on Service type; it applies uniformly.

## Customer Account
The Account every customer's Orders belong to. It's created automatically by the customer's first booking, from that booking's email and phone (both required). There are no guest Orders. A later booking with the same email goes into the same Account, once the customer proves the email with a **Sign-in Code**. Separate from an admin/staff Account (ADR-0005), even when both use the same email: an admin who books gets a Customer Account of their own, and admin and customer sign-ins never mix. See [ADR-0014](docs/adr/0014-accounts-created-at-booking-email-code-sign-in.md).

## Sign-in Code
A one-time 6-digit code emailed to a Customer Account's address, which signs the customer in. Customers only see it when a booking's email already has an Account: the booking flow shows its own login screen, then finishes the booking. Admins sign in separately. _Avoid_: password (for customers), magic link.

## Fulfillment Method
How a customer's sneakers get to the shop. Exactly two exist: **Pickup** and **Mail-In**. There is no in-person drop-off. Customers never bring sneakers to a studio or location. _Avoid_: drop-off, in-person, walk-in, studio.

## Pickup
The Fulfillment Method where the shop collects the sneakers from the customer's address at a scheduled date and time. Local to the NY/NJ/CT Tri-State area only.

## Mail-In Shipping
For a mail-in Item, the app captures and validates the customer's shipping address (address/maps validation, not just carrier label generation) and stores it. Actual shipping labels/logistics are not generated by the app in MVP — the customer arranges their own shipping to the shop. Label generation via a third-party carrier API is a future addition behind the same adapter seam. See [ADR-0010](docs/adr/0010-mail-in-address-capture-only.md).

## Manual Payment Confirmation
For Zelle/Cash Deposits or Balances (methods the system cannot verify programmatically), the Order does not advance past the Approved status until the owner explicitly marks that payment as received in admin. Apple Pay/card payments, by contrast, confirm automatically through the payment processor. See [ADR-0002](docs/adr/0002-manual-payment-confirmation.md).

## Open questions / not yet resolved
- Is an "Item" one shoe or one pair? (assumed: one pair, needs confirmation)
- How is the Order-level rollup status displayed to the customer exactly?
- How is a Balance delta (custom-quote Item priced higher than its rough estimate) communicated and collected?
- How do finished sneakers get back to a Pickup customer (return delivery to their address, or something else)? The Status Pipeline's "Ready for Pickup/Shipping" predates the no-drop-off decision: there, "Pickup" meant the customer collecting finished sneakers in person, which clashes with **Pickup** as a Fulfillment Method. Rename that status once the return leg is decided.
