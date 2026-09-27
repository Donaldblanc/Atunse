-- Bundles (CONTEXT.md): three Items in one Order. The Order records which
-- Bundle was bought; null for a single pair and for every earlier Order.
ALTER TABLE "orders" ADD COLUMN "bundleId" TEXT;

-- A Bundle's pairs are created in one statement and share a createdAt, so
-- each Item keeps its place (Pair 1-3). Every earlier Item is its Order's only one.
ALTER TABLE "items" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
