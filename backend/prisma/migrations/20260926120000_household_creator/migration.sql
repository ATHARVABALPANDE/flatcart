-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: households that predate this column are attributed to whoever
-- joined first, which is the member that created them. Without this they
-- would have no creator and so nobody able to delete them.
UPDATE "Household" h
SET "createdById" = (
  SELECT m."userId"
  FROM "HouseholdMember" m
  WHERE m."householdId" = h."id"
  ORDER BY m."joinedAt" ASC, m."id" ASC
  LIMIT 1
)
WHERE h."createdById" IS NULL;
