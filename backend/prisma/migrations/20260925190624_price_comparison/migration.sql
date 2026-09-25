-- Drop the old per-item store column (table is empty, safe)
ALTER TABLE "CartItem" DROP COLUMN "store";

-- Recreate the Store enum with only the 4 real stores
BEGIN;
ALTER TYPE "Store" RENAME TO "Store_old";
CREATE TYPE "Store" AS ENUM ('BLINKIT', 'ZEPTO', 'INSTAMART', 'BIGBASKET');
DROP TYPE "Store_old";
COMMIT;

-- Add the new nullable orderedStore column using the redefined enum
ALTER TABLE "CartItem" ADD COLUMN "orderedStore" "Store";

-- CreateTable
CREATE TABLE "ItemListing" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "checkedById" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSetting" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "freeDeliveryThreshold" DOUBLE PRECISION NOT NULL DEFAULT 199,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemListing_itemId_store_key" ON "ItemListing"("itemId", "store");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSetting_householdId_store_key" ON "StoreSetting"("householdId", "store");

-- AddForeignKey
ALTER TABLE "ItemListing" ADD CONSTRAINT "ItemListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CartItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemListing" ADD CONSTRAINT "ItemListing_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
