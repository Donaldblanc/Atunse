-- Today's Schedule on the admin Overview looks Orders up by collection
-- date (listCollectionsOn); without this it scans every Order.

-- CreateIndex
CREATE INDEX "orders_pickupDate_idx" ON "orders"("pickupDate");

