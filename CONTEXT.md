# Atunṣe / RestoredByDJ — Domain Glossary

This is a glossary of domain terms, not a spec. No implementation details.

## Order
The billing and shipping envelope a customer submits. Every Order belongs to a **Customer Account**. An Order is a **container**: it holds one or more Items and carries the customer's contact info for this booking, **Fulfillment Method** (Local Drop-Off or Mail-In), shipping address, its **Payments** and **Appointments**, and its **Conversation**. Admin screens identify it by its **Order Number**. An Order has no status of its own — its displayed status is a rollup derived from its Items' statuses (e.g. "least-advanced item" or an explicit summary like "2 of 3 items in progress").

## Item
One **pair** of sneakers submitted within an Order (not one individual shoe — left/right are never priced or tracked separately). An Item carries its own brand/model, condition photos, requested Services, price, and **its own status** through the restoration Status Pipeline. Items in the same Order advance independently — one Item can be In Progress while a sibling Item in the same Order is still Under Review awaiting approval.

## Order Number
An Order's sequential reference, e.g. "ATU-1008" (first Order: ATU-1001), used everywhere: admin screens, the booking confirmation and emails, and the customer's Zelle memo.

## Order Status (display)
There is no single Order status field. The customer-facing order view always shows a per-Item breakdown (each Item's own place in the Status Pipeline) — never a single collapsed label for the whole Order. Admin screens that list Orders by status (Pending Payment, In Progress, Ready, Completed, Cancelled) derive it from the Items and the Payments; it is never stored.

## Policy Acceptance
Two required parts, presented once, at the final review-and-submit step of order creation, before the Deposit is charged:
- **Pricing & Restoration Acknowledgments** — four risk acknowledgments, each its own checkbox: final pricing is determined after inspection (additional charges need the customer's approval first); results may vary; restoration involves inherent material risks; restoration doesn't guarantee structural or performance restoration. They record that the customer understood each risk. None of them, alone or together, is acceptance of the contract.
- **Terms Agreement** — one checkbox: "I have read and agree to the Terms of Service & Restoration Agreement and acknowledge the restoration risks described above." This is the contractual acceptance. The **Terms of Service & Restoration Agreement** is a PDF, linked from the checkbox.

No box is ever pre-checked, and no Order is submitted without every acknowledgment and the Terms Agreement. No per-policy contextual acceptance elsewhere in the flow. Each Order keeps its **Terms Acceptance** as evidence: when it was accepted, which agreement version (its permanent URL and the PDF's SHA-256), and each acknowledgment — see [ADR-0015](docs/adr/0015-terms-acceptance-evidence.md).

## Balance Delta
The difference between an Item's final price (set when its Quote is sent) and the rough estimate its share of the Deposit was based on. Handled by adjusting the Balance due at completion — the Deposit already paid is never re-charged or refunded for this; the customer is notified of the real total the moment the Quote is sent (not held back until the pair comes back).

## Service
A unit of cleaning or restoration work that can be attached to an Item: Standard Clean, Premium Clean, Oxidation Restoration, Sneaker Painting & Dyeing, or Reglue. The owner manages Services, their prices and descriptions on the admin Services & Pricing screen; a Service is deactivated, never deleted, since past Items name it. An Item can have multiple Services attached, but at most one cleaning tier (Standard or Premium, never both). Restoration Services combine freely with each other and with the cleaning tier.

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
A single payment equal to 50% of the sum of all Items' prices in an Order, charged once at submission — using each Item's published starting price where standard, and a rough estimate for Items pending a custom quote. The **Balance** is the quoted total (every live pair's quote, plus the Rush fee) less the Deposit, so it carries any delta once custom-quoted Items are finalized. It becomes a Pending Payment when the Order's last live pair reaches Ready for Drop-Off/Shipping (none if the Deposit already covers the total), with the Deposit's method, which the owner can change when marking it received. While Pending it follows a cancelled pair, and is dropped if the whole Order is cancelled. The Balance does not hold the admin's Update Status: the owner can move a pair to Completed (or any other status) with money outstanding. Only a Return visit's completion still waits for the Balance to be received, or for the Deposit to cover the quoted total.

## Status Pipeline
The sequence an **Item** (not the Order) moves through: Request Submitted → Under Review → Quote Sent → Approved → Awaiting Sneakers → In Progress → Quality Check → Ready for Drop-Off/Shipping → Completed. Cancelled is reachable from any state. The one step back: the owner can return an Item from Under Review to Request Submitted (e.g. a review started by mistake), since nothing has been quoted yet. ("Ready for Drop-Off/Shipping": DJ is ready to drop a Local Drop-Off pair back off, or a Mail-In pair is ready to ship back. Its code name is still `READY_FOR_PICKUP_SHIPPING`.)

## Approval Gate
Every Item, with no exceptions, must be reviewed and priced by the owner before the customer can pay/proceed on that Item. There is no auto-priced "standard" tier in the MVP — see [ADR-0001](docs/adr/0001-manual-review-every-item.md). The Approval Gate is therefore not conditional on Service type; it applies uniformly.

## Customer Account
The Account every customer's Orders belong to. It's created automatically by the customer's first booking, from that booking's email and phone (both required). There are no guest Orders. A later booking with the same email goes into the same Account, once the customer proves the email with a **Sign-in Code**. Separate from an admin/staff Account (ADR-0005), even when both use the same email: an admin who books gets a Customer Account of their own, and admin and customer sign-ins never mix. See [ADR-0014](docs/adr/0014-accounts-created-at-booking-email-code-sign-in.md).

## Sign-in Code
A one-time 6-digit code emailed to a Customer Account's address, which signs the customer in. Customers only see it when a booking's email already has an Account: the booking flow shows its own login screen, then finishes the booking. Admins sign in separately. _Avoid_: password (for customers), magic link.

## Fulfillment Method
How a customer's sneakers get to the shop and back. Exactly two exist: **Local Drop-Off** and **Mail-In**. Customers never bring sneakers to a studio or location, and never collect them in person. _Avoid_: "pickup" (in anything customers read), in-person, walk-in, studio.

## Local Drop-Off
The Fulfillment Method where DJ collects the sneakers from the customer's address at a date and time booked in the booking flow (a **collection time**, 8:00 AM–10:00 PM New York time), and drops them back off at that address when they're done. Local to the NY/NJ/CT Tri-State area only. Its code name is `PICKUP` (`FulfillmentMethod`, `pickupDate`/`pickupSlot`, `pickup-window.ts`): the name predates this one and is kept so stored Orders and the API don't change. The customer-facing name comes from `FULFILLMENT_LABELS`. _Avoid_: "pickup" in customer-facing text; "drop-off" alone (it reads as the customer bringing sneakers in), so always "Local Drop-Off".

## Mail-In Shipping
For a mail-in Item, the app captures and validates the customer's shipping address (address/maps validation, not just carrier label generation) and stores it. Actual shipping labels/logistics are not generated by the app in MVP — the customer arranges their own shipping to the shop. Finished Mail-In pairs are shipped back to that address. Label generation via a third-party carrier API is a future addition behind the same adapter seam. See [ADR-0010](docs/adr/0010-mail-in-address-capture-only.md).

## Payment
One amount an Order is owed or has received: the **Deposit**, the **Balance**, or a **Full** payment covering the whole Order at once. Each has a method (Zelle, Cash, Card or Apple Pay) and is Pending until received; a card or Apple Pay charge can also be Failed, and a received Payment can be Refunded. Booking creates the Deposit as Pending, by Zelle. _Avoid_: treating an Item's status as proof of payment.

## Appointment
A booked time on the admin Calendar for a Local Drop-Off Order: **Collection** (DJ collects the pair from the customer) or **Return** (DJ drops it back off). At most one of each per Order; rescheduling moves it. The Order keeps the collection time the customer originally booked. **Completing** a visit also moves the Order's pairs along: a Collection takes each pair in Awaiting Sneakers to In Progress, a Return each pair in Ready for Drop-Off/Shipping to Completed. Pairs that aren't there yet (not approved), or are held on the Deposit or the Balance (the Completed rule above), stay where they are.

## Conversation
A message thread between the shop and a customer, usually about one of their Orders (an inquiry can come before any booking), shown in the admin Messages inbox. A customer message is **unread** until the shop reads it. Archiving hides a Conversation from the inbox without deleting it.

## Review
A customer's rating (1–5) and words about an Order, with optional photos. At most one per Order; a **Verified Customer** review is tied to one of their Orders. New reviews wait for the owner to publish them on the website, or hide them; the owner can post a public reply.

## Note
Something the shop records about a customer, optionally about one of their Orders (e.g. "Extra care on the midsole"). Admin only; customers never see Notes.

## Operating Hours
When Local Drop-Off collections can be booked, per weekday, in shop time. Set in admin Settings, along with whether Local Drop-Off and Mail-In are open for booking at all.

## Inventory Item
A supply, material or care product the shop keeps on hand (e.g. cleaning solution, lace sets, brushes), with a stock count and a low-stock level; it's **Low Stock** at or below that level and **Out of Stock** at zero. Every change to its stock is recorded (restocked, used on an Order, adjusted). Each can name the **Supplier** it's restocked from. _Avoid_: "item" alone for these: an **Item** is a customer's pair.

## Manual Payment Confirmation
For Zelle/Cash Deposits or Balances (methods the system cannot verify programmatically), the owner marks that payment as received in admin. The admin's Update Status never blocks on it (amended): the owner can move a pair to any status regardless. Apple Pay/card payments, by contrast, confirm automatically through the payment processor. See [ADR-0002](docs/adr/0002-manual-payment-confirmation.md).

## Open questions / not yet resolved
- Do sales tax (the design shows 8.875%) and a Local Drop-Off fee apply, and are they part of the Deposit or only the Balance? Orders can store both; nothing computes them yet.
- Is an "Item" one shoe or one pair? (assumed: one pair, needs confirmation)
- How is the Order-level rollup status displayed to the customer exactly?
- How is a Balance delta (custom-quote Item priced higher than its rough estimate) communicated and collected?
