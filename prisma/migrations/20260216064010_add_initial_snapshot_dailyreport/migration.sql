-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "initialCapturedAt" TIMESTAMP(3),
ADD COLUMN     "initialIssues" JSONB,
ADD COLUMN     "initialPayload" JSONB;
