# 0017. The Quote gate applies only to Restoration and Custom-Work

## Status
Accepted. Supersedes ADR-0001.

## Context
ADR-0001 put every Item through manual owner review and a Quote before it could be approved, regardless of which Service it booked. That was the right default while the catalog had no fixed prices. It no longer fits the catalog: Cleaning (Standard, Premium) and the Add-ons (Lace Replacement, Premium Deodorizing Treatment, Waterproof Seal) are flat, published prices with no condition-dependent variance. Only Restoration (Oxidation Restoration, Reglue) and Custom Work (Sneaker Painting & Dyeing) depend on the pair's actual condition, which the owner has to see before naming a final price.

Holding a Cleaning-only or Add-on-only booking in Under Review, waiting on a Quote the owner would just send at the published price anyway, costs the customer a wait and the owner a review step that adds no information.

## Decision
An Item requires a Quote and the customer's approval only if at least one of its Services is category `restoration` or `custom-work` (`itemRequiresQuote` in `service-catalog.ts`). An Item whose Services are all `cleaning`/`additional` is created already `APPROVED`, priced at its published estimate, with no Under Review step, no Quote Sent, and no customer approval wait. The repository records this with a system audit entry (`AUTO_APPROVED_SET_PRICE`, no actor) so the skip is visible in the Item's history.

A Bundle's pairs are always Cleaning-tier (plus Add-ons), so every Bundle pair auto-approves under this rule.

## Consequences
- The Item Status Pipeline (`REQUEST_SUBMITTED → UNDER_REVIEW → QUOTE_SENT → APPROVED → …`) still exists and is unchanged for Restoration/Custom-Work Items; `sendQuote` and `recordApproval` only ever apply to those.
- The Overview's Approval Gate (and "needs a Quote" panels) now only ever shows Items that actually need one; a Cleaning/Add-on-only Item never appears there.
- Order detail shows a short note ("Set price — no quote needed") on an auto-approved pair, since it has no Quote-Sent history to otherwise explain why it's already Approved.
- Amended 2026-10-11: admin never shows or offers Under Review, Quote Sent or Approved for a pair that needs no Quote (decided from its Services alone, so older Orders count too). Its stored `REQUEST_SUBMITTED`, `UNDER_REVIEW`, `QUOTE_SENT` and `APPROVED` all display as "Request Submitted" (`displayStatus` in `domain.ts`); stored data is unchanged. Its timeline is Request Submitted → Awaiting Sneakers → In Progress → Quality Check → Ready for Drop-Off/Shipping → Completed (`statusPipeline`), and `adminStatusMoves` (so the API too) never offers it those four statuses. An Order uses the full pipeline if any live pair needs a Quote, otherwise the quote-free one; a mixed Order keeps per-pair behaviour. Status filters and the Overview's "Needs a Quote" count follow the displayed status.
- If the catalog later adds a Service whose price does depend on condition, it must be tagged `restoration` or `custom-work` (or the categories it's compared against must change) for this rule to catch it — the gate is purely a function of category, not of the Service id.
