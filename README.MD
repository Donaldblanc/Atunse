# Atunse

Sneaker cleaning and restoration ordering platform for **RestoredByDJ** (New York, NY).

Customers photograph a pair, pick services, and submit a request. DJ reviews the photos,
sends a price, and moves the order through the shop. Payment is handled offline in v1 —
the app tells the customer how to pay and DJ marks it received.

> Brand name and legal entity are not the same thing. "Atunṣe" is the customer-facing name;
> RestoredByDJ is the business. **Open decision:** which one leads on the site header and domain.

---

## Status

Pre-development. Prototypes exist, no application code yet.

| Artifact       | Path                      | What it is                                                                               |
| -------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| Sitemap        | `docs/sitemap.md`         | v1 routes, order statuses, admin structure                                               |
| v1 prototype   | `docs/prototypes/v1.html` | Guest quote flow, mobile-first, launch scope, Accounts, per-item invoicing, studio, shop |
| Intake answers | `docs/discovery.md`       | Client questionnaire responses                                                           |

---

## v1 scope (launch)

Five things, nothing else:

1. **Quote request form** — multi-service, multi-pair, photo upload
2. **Admin review and quote** — DJ prices the job after seeing photos
3. **Order status tracking** — nine stages, customer-visible
4. **Offline payment** — Zelle, Apple Pay or cash; 50% deposit; DJ marks paid
5. **Email + SMS notifications** on the stages that need customer action

**Deferred to v2:** customer accounts, loyalty rewards, in-app card payment, product shop,
how-to video library, nonprofit pages, referrals, analytics.

**Deferred by decision, not oversight:** loyalty rewards were cut from v1 to protect the
launch date. Point rules are still undefined.

### Pricing

| Service                  | Price     | Instant book? |
| ------------------------ | --------- | ------------- |
| Basic clean              | $30       | Yes           |
| Deep clean               | $50       | Yes           |
| Sole whitening           | from $40  | No — quote    |
| Paint restoration        | from $50  | No — quote    |
| Reglue / sole separation | $30       | No — quote    |
| Complete restoration     | from $100 | No — quote    |

Anything priced "from" submits as a request. DJ confirms the number after inspecting photos.
Turnaround is **72 hours from intake**, not from submission — word it that way everywhere.

### Order statuses

`request_submitted` → `under_review` → `quote_sent` → `approved` → `awaiting_sneakers`
→ `in_progress` → `quality_check` → `ready_for_pickup` → `completed`

`cancelled` is reachable from any state.

---

## Proposed stack

Not locked. Chosen to keep a solo-operator app cheap and boring.

- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind
- **Database:** Postgres
- **ORM:** Prisma
- **File storage:** S3-compatible bucket for sneaker photos
- **Email:** Resend or Postmark
- **SMS:** Twilio
- **Admin auth:** single account, password + TOTP
- **Hosting:** Vercel

No payment processor in v1. When card payment lands in v2, Stripe.

---

## Getting started

```bash
git clone <repo-url>
cd atunse
npm install
cp .env.example .env.local   # fill in the values below
npm run db:migrate
npm run dev
```

Runs on `http://localhost:3000`. Admin is at `/admin`.

### Environment variables

```
DATABASE_URL=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
NEXT_PUBLIC_SITE_URL=
```

Photo uploads are customer property — the bucket is private,
served through signed URLs only.

---

## Repo layout

```
app/
  (site)/           public marketing pages
  quote/            the request flow
  track/[order]/    customer order lookup
  admin/            DJ's dashboard
  api/
components/
lib/
  email/            templates and send helpers
  sms/
  status.ts         status machine, single source of truth
prisma/
  schema.prisma
docs/
  sitemap.md
  discovery.md
  prototypes/
public/
```

---

## Data model sketch

```
Order        number, customer, method, return_method, status, turnaround,
             deposit_cents, total_cents, deposit_paid_at, balance_paid_at
Item         order_id, category, brand, model, size, material, condition, notes
Photo        item_id, storage_key, angle
LineItem     item_id, service, price_cents, state (pending|approved|declined|paid)
Customer     name, email, phone, address
Message      order_id, direction, body, sent_at
StatusEvent  order_id, from, to, changed_at
```

Items are separate from orders on purpose. One order can hold several pairs, each with its
own photos and services, which is what lets a customer approve part of a quote and decline
the rest.

Existing customer records will be imported from a spreadsheet with these columns:
`Name, Phone, Email, City, Last Service, Notes`.

---

## Photo uploads

- Accepted: JPG, JPEG, PNG, HEIC
- Max 20 MB per file
- Five angles requested per pair: side, opposite side, sole, heel, damage close-up
- HEIC needs server-side conversion; browsers won't render it consistently

Bad photos are the main cause of re-quoting. The upload UI should prompt for one angle at a
time rather than presenting an empty grid.

---

## Legal pages

Required before launch. All five must exist and be linked from the request form, with an
explicit agreement checkbox before submission:

- Privacy policy
- Terms of service
- Refund and cancellation policy
- Shipping and mail-in policy
- Restoration disclaimer

The disclaimer needs to say plainly that final pricing follows inspection, that severe damage
and specialty materials may cost more, that results vary, and that restoration does not
guarantee structural or performance recovery.

---

## Open decisions

These block work. Listed roughly in order of how much they hold up.

- [ ] Brand lockup and domain — Atunṣe or RestoredByDJ leading
- [ ] Is there a physical studio address, or is drop-off arranged per order?
- [ ] Zelle and Apple Pay handles to display on the invoice
- [ ] Mail-in: shipping address, and who pays inbound vs return
- [ ] Launch date — targeting Sept 26

## Content owed by client

- [ ] Logo files and brand colours
- [ ] 8–12 before/after photos
- [ ] Service descriptions
- [ ] FAQ
- [ ] The five policy documents
- [ ] Customer spreadsheet for import

---

## Contacts

**Owner / approver:** Adedeji Lawal — heathausgroup@gmail.com

Design and functionality sign-off runs through the owner before launch.
