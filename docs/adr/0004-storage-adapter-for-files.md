# 0004. File storage sits behind a swappable adapter, S3 as the initial implementation

## Status
Accepted

## Context
Photos are core to the product (every Item needs multiple condition photos,
10-20MB each, JPG/PNG/HEIC). Where they're stored is not a business
decision but an infrastructure one, and the team wants the option to move to
Supabase or Firebase storage later without disturbing use-case code.

## Decision
Define a `FileStorage` adapter interface (e.g. `getUploadUrl(item, filename)`,
`getServingUrl(fileId)`, `delete(fileId)`) owned by the use-case layer per
ADR-0003. Implement it first against S3 (presigned upload URLs, CDN in front
for serving). Supabase/Firebase Storage implementations can be added later
as alternate adapters without touching any use-case or API route.

## Consequences
- Slight indirection cost now (an interface + one implementation) for a benefit that only pays off if/when a swap actually happens.
- Use-cases and API routes never import an S3 SDK directly — only the adapter interface — so the swap, if it comes, is contained to one new adapter file plus a config change.
- CDN/caching, retention, and access-control policy for photos still need to be decided (see TODO/open questions) — this ADR only fixes the seam, not those policies.

## Addendum (2026-09-26): presigned POST, and a local driver for development
The first implementation (`src/shared/storage/`) narrows the interface to
what the booking flow needs today: `createUploadTarget({ key, contentType,
maxBytes })`, which returns a form-POST target `{ url, fields }`. Serving
and deleting are added when the admin Item detail screen needs them.

- **Presigned POST instead of presigned PUT.** A POST policy can enforce a
  `content-length-range` and pin the `Content-Type`, so an issued target
  can't be reused for a different or oversized file. A PUT URL can't cap
  the size.
- **Server-minted keys.** Keys are `bookings/<uuid>/<n>.<ext>`, minted by
  `POST /api/v1/uploads`. `submitOrder` rejects any photo key not of that
  shape, so a client can't attach arbitrary bucket objects to an Order.
- **`LocalFileStorage` for development.** It mimics a presigned POST with
  an HMAC-signed target and a dev-only receiving route that writes to
  `.uploads/`. `STORAGE_DRIVER` selects the driver; production refuses the
  local driver and fails with a clear 503 when S3 isn't configured, rather
  than accepting photos it can't keep.
- **S3-compatible providers.** The bucket is Neon's S3-compatible storage.
  `S3FileStorage` takes an optional endpoint (`S3_ENDPOINT` or
  `AWS_ENDPOINT_URL_S3`) and switches to path-style URLs when one is set,
  since bucket subdomains don't resolve there. No other code changes.

## Addendum (2026-09-27): upload hardening (#77)
- **Targets are capped at the declared size.** Each photo's
  `content-length-range` is the size the browser declared, not the 15 MB
  ceiling. Targets are valid for 5 minutes.
- **Photos are verified before an Order is created.** `FileStorage.inspect`
  (a ranged GET of the first 16 bytes, which also gives the size) must
  find the object, and its magic number must match the image type in its
  key. A target's pinned Content-Type is only a label on whatever bytes
  were sent.
- **Per-IP rate limits** on the public routes, counted in Postgres
  (`rate_limit_buckets`), since serverless instances share no memory.
- **Bucket settings live in scripts, not the app.** CORS (site origins,
  `POST` only) and orphan cleanup run through `npm run storage:configure`
  and `npm run storage:cleanup`, both dry-run by default. A lifecycle rule
  can't tell attached photos from abandoned ones, so cleanup checks the
  database.
