-- 1) Add columns (รองรับตารางมีข้อมูลอยู่แล้ว)
ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "DailyReport"
  ADD COLUMN IF NOT EXISTS "payload" JSONB;

-- 2) Ensure uniqueness by (projectId, date)
CREATE UNIQUE INDEX IF NOT EXISTS "DailyReport_projectId_date_key"
ON "DailyReport" ("projectId","date");


-- 3) Indexes (ถ้ามีอยู่แล้วจะไม่สร้างซ้ำ)
CREATE INDEX IF NOT EXISTS "DailyReport_projectId_idx" ON "DailyReport"("projectId");
CREATE INDEX IF NOT EXISTS "DailyReport_date_idx" ON "DailyReport"("date");
