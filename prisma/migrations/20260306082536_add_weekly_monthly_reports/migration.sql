-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "payload" JSONB,
    "sourceReportIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "payload" JSONB,
    "sourceReportIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyReport_projectId_idx" ON "WeeklyReport"("projectId");

-- CreateIndex
CREATE INDEX "WeeklyReport_startDate_idx" ON "WeeklyReport"("startDate");

-- CreateIndex
CREATE INDEX "WeeklyReport_endDate_idx" ON "WeeklyReport"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_projectId_year_weekNo_key" ON "WeeklyReport"("projectId", "year", "weekNo");

-- CreateIndex
CREATE INDEX "MonthlyReport_projectId_idx" ON "MonthlyReport"("projectId");

-- CreateIndex
CREATE INDEX "MonthlyReport_startDate_idx" ON "MonthlyReport"("startDate");

-- CreateIndex
CREATE INDEX "MonthlyReport_endDate_idx" ON "MonthlyReport"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReport_projectId_year_month_key" ON "MonthlyReport"("projectId", "year", "month");

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
