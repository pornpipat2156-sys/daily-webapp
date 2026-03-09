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
      <div className="w-full space-y-3 px-3 py-3 sm:px-4 sm:py-4">
        <section className="overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(135deg,rgba(240,244,255,0.96),rgba(236,249,245,0.9),rgba(255,244,246,0.92))] p-5 shadow-[0_18px_50px_rgba(148,163,184,0.16)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
                Preview
              </div>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Daily report preview
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/70 bg-white/88 px-4 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_rgba(148,163,184,0.14)] hover:bg-white"
            >
              ย้อนกลับ
            </button>
          </div>
        </section>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          ไม่พบ reportId สำหรับเปิด Preview
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 px-3 py-3 sm:px-4 sm:py-4">
      <section className="overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(135deg,rgba(240,244,255,0.96),rgba(236,249,245,0.9),rgba(255,244,246,0.92))] p-5 shadow-[0_18px_50px_rgba(148,163,184,0.16)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">
              Preview
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Daily report preview
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex min-h-9 items-center rounded-full border border-white/70 bg-white/88 px-4 text-xs font-semibold text-slate-600 shadow-[0_8px_24px_rgba(148,163,184,0.14)]">
              Report: {reportId}
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/70 bg-white/88 px-4 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_rgba(148,163,184,0.14)] hover:bg-white"
            >
              ย้อนกลับ
            </button>
          </div>
        </div>
      </section>

      <div className="w-full">
        <ReportPreviewReadonly reportId={reportId} />
      </div>
    </div>
  );
}