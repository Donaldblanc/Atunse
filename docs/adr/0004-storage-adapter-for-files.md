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
