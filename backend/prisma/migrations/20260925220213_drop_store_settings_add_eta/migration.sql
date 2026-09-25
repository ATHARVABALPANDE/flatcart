-- DropForeignKey
ALTER TABLE "StoreSetting" DROP CONSTRAINT "StoreSetting_householdId_fkey";

-- AlterTable
ALTER TABLE "ItemListing" ADD COLUMN     "eta" TEXT;

-- DropTable
DROP TABLE "StoreSetting";

