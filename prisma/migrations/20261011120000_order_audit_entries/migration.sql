-- CreateTable
CREATE TABLE "order_audit_entries" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorAccountId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_audit_entries_orderId_idempotencyKey_key" ON "order_audit_entries"("orderId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "order_audit_entries" ADD CONSTRAINT "order_audit_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
