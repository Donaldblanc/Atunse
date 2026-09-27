-- ADR-0014: a photo belongs to exactly one Item. Keys move from the
-- items."photoKeys" array into their own table with a unique key, so the
-- database settles two concurrent bookings quoting the same key (the old
-- check-then-insert let both win).

-- CreateTable
CREATE TABLE "item_photos" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "item_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_photos_key_key" ON "item_photos"("key");
CREATE INDEX "item_photos_itemId_idx" ON "item_photos"("itemId");

-- AddForeignKey
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Move existing keys over, keeping their order. A key already shared by two
-- legacy Items stays with the earlier one.
INSERT INTO "item_photos" ("id", "itemId", "key", "position")
SELECT gen_random_uuid()::text, i."id", p."key", (p."ordinality" - 1)::int
FROM "items" i
CROSS JOIN LATERAL unnest(i."photoKeys") WITH ORDINALITY AS p("key", "ordinality")
ORDER BY i."createdAt", p."ordinality"
ON CONFLICT ("key") DO NOTHING;

-- AlterTable
ALTER TABLE "items" DROP COLUMN "photoKeys";
