-- #76: remember a fingerprint of each submission, so a retry that reuses a
-- submission key with different booking details is refused rather than
-- answered with the original, now stale, Order.
ALTER TABLE "orders" ADD COLUMN "submissionFingerprint" TEXT;
