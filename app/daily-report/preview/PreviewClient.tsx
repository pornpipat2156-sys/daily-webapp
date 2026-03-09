"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ReportPreviewReadonly } from "@/components/ReportPreviewReadonly";

function PreviewHero({
  reportId,
  onBack,
}: {
  reportId?: string;
  onBack: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(135deg,rgba(240,244,255,0.96),rgba(236,249,245,0.9),rgba(255,244,246,0.92))] p-5 shadow-[0_18px_50px_rgba(148,163,184,0.16)] backdrop-blur dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(30,41,59,0.96))] dark:shadow-[0_20px_60px_rgba(2,6,23,0.45)] sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">
            Preview
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Daily report preview
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
          </p>

          {reportId ? (
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300">
              <span className="text-slate-400 dark:text-slate-500">Report:</span>
              <span className="truncate text-slate-700 dark:text-slate-200">{reportId}</span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/70 bg-white/88 px-4 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_rgba(148,163,184,0.14)] transition hover:bg-white dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100 dark:shadow-[0_12px_30px_rgba(2,6,23,0.35)] dark:hover:bg-slate-900"
        >
          ย้อนกลับ
        </button>
      </div>
    </section>
  );
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-dashed border-slate-200 bg-white/85 p-6 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
      <div className="flex flex-col items-start gap-4">
        <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          ไม่พบข้อมูล
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            ไม่พบ reportId สำหรับเปิด Preview
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            กรุณาเปิดหน้านี้ผ่านการสร้างรายงาน หรือส่ง `reportId` มาทาง query string
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          กลับไปหน้าก่อนหน้า
        </button>
      </div>
    </section>
  );
}

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

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 px-3 py-3 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100 sm:px-4 sm:py-4">
      <div className="space-y-3">
        <PreviewHero reportId={reportId || undefined} onBack={() => router.back()} />

        {!reportId ? (
          <EmptyState onBack={() => router.back()} />
        ) : (
          <section className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-2 shadow-[0_18px_50px_rgba(148,163,184,0.08)] dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-[0_20px_60px_rgba(2,6,23,0.32)] sm:p-3">
            <ReportPreviewReadonly reportId={reportId} />
          </section>
        )}
      </div>
    </div>
  );
}