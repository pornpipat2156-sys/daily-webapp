"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReportPreviewReadonly } from "@/components/ReportPreviewReadonly";

export default function PreviewClient() {
  const searchParams = useSearchParams();
  const [reportId, setReportId] = useState("");

  const queryReportId = searchParams.get("reportId") || "";

  useEffect(() => {
    const fromQuery = queryReportId.trim();
    if (fromQuery) {
      setReportId(fromQuery);
      return;
    }

    try {
      const fromSession = sessionStorage.getItem("lastSubmittedReportId") || "";
      setReportId(fromSession);
    } catch {
      setReportId("");
    }
  }, [queryReportId]);

  if (!reportId) {
    return (
      <div className="px-4 py-4 sm:px-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ไม่พบ reportId สำหรับเปิด Preview
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-2 py-2 sm:px-3 sm:py-3 lg:px-4">
      <ReportPreviewReadonly reportId={reportId} />
    </div>
  );
}