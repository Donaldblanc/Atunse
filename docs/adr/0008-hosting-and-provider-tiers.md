# 0008. Hosting and provider tiers: free/trial-first, paid at launch

## Status
Accepted

## Context
Pre-launch, the goal is to build and test the full flow at near-zero cost.
Hosting has genuine free tiers that work for this; email/SMS providers do
not (any real sending volume is paid), but their free/trial allowances are
enough to build against.

## Decision
- **App hosting:** Vercel.
- **Database:** Postgres via **Neon** (chosen over Supabase to keep the database decoupled from auth/storage, since ADR-0004 and ADR-0005 already commit to separate, swappable adapters for storage and auth rather than a bundled platform). Revisit if consolidating onto Supabase's bundle later looks worth the coupling.
- **Email:** Resend (ADR-0006), on its permanent free tier (3,000/month) — no paid budget needed for email at MVP volume.
- **SMS:** deferred behind a feature toggle (ADR-0009) — no provider spend until it's switched on.

## Consequences
- $0 infra cost through development and at MVP launch: Vercel, Neon, and Resend are all genuinely free at this scale, not just trial.
- SMS remains the one line item with real future cost, and it's explicitly toggled off until that spend is worth taking on (ADR-0009).
- Eventually Vercel/Neon/Resend free-tier limits will be exceeded by growth — budget for that when it happens, not preemptively.
- Choosing Neon over Supabase trades a slightly larger number of vendor relationships (DB separate from auth/storage) for keeping each adapter (ADR-0003/0004/0005) genuinely swappable rather than implicitly tied to one platform.
