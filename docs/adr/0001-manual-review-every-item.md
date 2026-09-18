# 0001. Every Item requires manual owner review before pricing

## Status
Accepted

## Context
Restoration pricing depends on physical condition the photos don't fully capture
(wear patterns, material, prior repairs). The original brief distinguished
"standard" work (auto-priceable) from "complex" work (needs approval), which
would require an auto-pricing rate table and a rule set deciding what counts
as standard — a real classification problem, and wrong on the safe side means
under-pricing labor.

## Decision
Every Item, regardless of Service selected, moves through Under Review and
gets a price only after the owner (DJ) looks at it. There is no auto-priced
"standard" tier and no rate-table pricing engine in the MVP. This also means
the customer never pays before an owner has seen every Item's photos.

## Consequences
- No pricing engine / rate table to build or maintain for MVP — smaller surface, faster to ship.
- Owner is a hard bottleneck on every single order; this is acceptable now (single-person shop, matches "final pricing after inspection" policy) but does not scale past the owner's personal review capacity.
- Item Status Pipeline always passes through Under Review → Quote Sent → Approved for every Item; there is no shortcut path.
- When the business adds staff or wants faster turnaround, revisit: reintroduce a published price list for a defined "standard" subset, gated by whatever rule the business settles on then.
