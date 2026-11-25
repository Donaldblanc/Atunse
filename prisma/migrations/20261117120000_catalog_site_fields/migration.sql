-- ADR-0016 step 2: the customer site and booking read the catalog from the
-- database, so the Bundle fields that used to live only in code move here.

-- AlterTable
ALTER TABLE "bundles" ADD COLUMN "pairServiceIds" TEXT[] DEFAULT ARRAY['premium']::TEXT[],
ADD COLUMN "endsAt" TIMESTAMP(3);

-- Start of Fall Special: Standard Clean on every pair, ends the end of December 21st 2026 (New York time).
UPDATE "bundles"
SET "pairServiceIds" = ARRAY['standard']::TEXT[], "endsAt" = '2026-12-22T05:00:00Z'
WHERE "id" = 'fall-boots';

-- alsoFrom was nullable and only Oxidation Restoration had a value; every Service now has an array.
UPDATE "services" SET "alsoFrom" = '[]'::jsonb WHERE "alsoFrom" IS NULL;
UPDATE "services" SET "alsoFrom" = '[{"label":"Sole","cents":4000}]'::jsonb WHERE "id" = 'oxidation';

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "alsoFrom" SET NOT NULL,
ALTER COLUMN "alsoFrom" SET DEFAULT '[]';
