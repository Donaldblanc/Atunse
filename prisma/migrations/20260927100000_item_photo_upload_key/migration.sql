-- #77: photos are copied on submit to a key no upload target can write to.
-- `uploadKey` keeps the key the browser uploaded to, unique, so an upload
-- still belongs to exactly one Item. Existing photos were never copied:
-- their upload key is their key.
ALTER TABLE "item_photos" ADD COLUMN "uploadKey" TEXT;
UPDATE "item_photos" SET "uploadKey" = "key";
ALTER TABLE "item_photos" ALTER COLUMN "uploadKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "item_photos_uploadKey_key" ON "item_photos"("uploadKey");
