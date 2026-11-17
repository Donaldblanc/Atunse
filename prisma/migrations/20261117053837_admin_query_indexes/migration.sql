-- CreateIndex
CREATE INDEX "items_orderId_idx" ON "items"("orderId");

-- CreateIndex
CREATE INDEX "items_status_idx" ON "items"("status");

-- CreateIndex
CREATE INDEX "orders_pickupDate_idx" ON "orders"("pickupDate");

-- CreateIndex
CREATE INDEX "orders_accountId_createdAt_idx" ON "orders"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");
