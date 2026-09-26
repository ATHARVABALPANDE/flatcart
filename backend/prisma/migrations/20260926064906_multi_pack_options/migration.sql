-- DropIndex
DROP INDEX "ItemListing_itemId_store_key";

-- AlterTable
ALTER TABLE "ItemListing" ALTER COLUMN "packSize" SET NOT NULL,
ALTER COLUMN "packSize" SET DEFAULT '1 unit';

-- CreateIndex
CREATE UNIQUE INDEX "ItemListing_itemId_store_packSize_key" ON "ItemListing"("itemId", "store", "packSize");

