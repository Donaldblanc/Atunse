-- AlterTable
ALTER TABLE "orders" ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);

-- Orders created before this column existed already sent their
-- confirmation, so a late retry must not send it again.
UPDATE "orders" SET "confirmationEmailSentAt" = "createdAt";
