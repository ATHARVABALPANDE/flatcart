-- CreateEnum
CREATE TYPE "ListingSource" AS ENUM ('MANUAL', 'LIVE_API');

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "qcApiKey" TEXT;

-- AlterTable
ALTER TABLE "ItemListing" ADD COLUMN     "source" "ListingSource" NOT NULL DEFAULT 'MANUAL';

