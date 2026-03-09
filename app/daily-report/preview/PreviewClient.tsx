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
      <div className="w-full px-3 py-3 sm:px-4">
        <div className="mb-4 rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(148,163,184,0.14)] backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            Preview
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Daily report preview
          </h1>
          <p className="mt-3 text-base text-slate-500 sm:text-lg">
            ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
          </p>

          <div className="mt-5">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ย้อนกลับ
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ไม่พบ reportId สำหรับเปิด Preview
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 py-3 sm:px-4">
      <div className="mb-4 rounded-[24px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(148,163,184,0.14)] backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Preview
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Daily report preview
            </h1>
            <p className="mt-3 text-base text-slate-500 sm:text-lg">
              ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ย้อนกลับ
            </button>
          </div>
        </div>
      </div>

      <ReportPreviewReadonly reportId={reportId} />
    </div>
  );
}