-- CreateTable
CREATE TABLE "ReportApproval" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "approverRole" TEXT,
    "approverUserId" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportApproval_reportId_idx" ON "ReportApproval"("reportId");

-- CreateIndex
CREATE INDEX "ReportApproval_approverUserId_idx" ON "ReportApproval"("approverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportApproval_reportId_approverName_key" ON "ReportApproval"("reportId", "approverName");

-- AddForeignKey
ALTER TABLE "ReportApproval" ADD CONSTRAINT "ReportApproval_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportApproval" ADD CONSTRAINT "ReportApproval_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
