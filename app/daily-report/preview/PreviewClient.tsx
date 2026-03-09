"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportPreviewReadonly } from "@/components/ReportPreviewReadonly";

export default function PreviewClient() {
  const router = useRouter();
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
      <div className="w-full space-y-4 px-4 py-4">
        <section className="rounded-xl border border-border bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Preview
              </div>

              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                Daily report preview
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ย้อนกลับ
            </button>
          </div>
        </section>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ไม่พบ reportId สำหรับเปิด Preview
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 px-4 py-4">
      <section className="rounded-xl border border-border bg-white/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Preview
            </div>

            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Daily report preview
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-600">
              Report: {reportId}
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ย้อนกลับ
            </button>
          </div>
        </div>
      </section>

      <ReportPreviewReadonly reportId={reportId} />
    </div>
  );
}