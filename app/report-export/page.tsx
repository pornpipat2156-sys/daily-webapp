"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  ReportPreviewForm,
  type ReportRenderModel,
} from "@/components/ReportPreviewReadonly";
import {
  SummaryAggregatePreview,
  type SummaryDocumentModel,
} from "@/components/SummaryAggregatePreview";

type ExportResponse =
  | {
      ok: true;
      found: true;
      renderMode: "daily";
      documentTitle: string;
      dailyModel: ReportRenderModel;
    }
  | {
      ok: true;
      found: true;
      renderMode: "summary";
      documentTitle: string;
      summaryModel: SummaryDocumentModel;
    }
  | {
      ok: true;
      found: false;
      message: string;
    }
  | {
      ok: false;
      message: string;
    }
  | null;

function ReportExportContent() {
  const searchParams = useSearchParams();

  const projectId = searchParams.get("projectId") || "";
  const type = searchParams.get("type") || "daily";
  const date = searchParams.get("date") || "";
  const auto = searchParams.get("auto") === "1";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExportResponse>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ projectId, type, date });
        const res = await fetch(`/api/report-browser?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({
          ok: false,
          message: "โหลดข้อมูลไม่สำเร็จ",
        }));

        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) {
          setData({
            ok: false,
            message: String(e?.message || e || "โหลดข้อมูลไม่สำเร็จ"),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (projectId && type && date) {
      load();
    } else {
      setLoading(false);
      setData({
        ok: false,
        message: "missing projectId/type/date",
      });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId, type, date]);

  useEffect(() => {
    if (!auto) return;
    if (!data) return;
    if (!("ok" in data) || data.ok !== true) return;
    if (!("found" in data) || data.found !== true) return;

    const timer = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [auto, data]);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-slate-100 text-slate-900">
        <div className="no-print mx-auto max-w-5xl px-2 py-3 sm:px-4 sm:py-4">
          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">PDF Export (A4)</div>
              <div className="text-sm text-slate-500">
                หน้านี้พิมพ์หรือบันทึกเฉพาะตัว Preview ไม่ใช่การ screenshot หน้าเว็บไซต์
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-900 px-5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              พิมพ์ / Save PDF
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[900px] px-2 pb-8 sm:px-4">
          {loading ? (
            <div className="mx-auto max-w-[794px] rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500 shadow-sm">
              กำลังโหลดเอกสาร...
            </div>
          ) : !data ? (
            <div className="mx-auto max-w-[794px] rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500 shadow-sm">
              ไม่พบข้อมูล
            </div>
          ) : "ok" in data && data.ok === false ? (
            <div className="mx-auto max-w-[794px] rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700 shadow-sm">
              {data.message || "เกิดข้อผิดพลาด"}
            </div>
          ) : "found" in data && data.found === false ? (
            <div className="mx-auto max-w-[794px] rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-700 shadow-sm">
              {data.message || "ไม่พบรายงาน"}
            </div>
          ) : "renderMode" in data && data.renderMode === "daily" ? (
            <div className="mx-auto">
              <ReportPreviewForm model={data.dailyModel} />
            </div>
          ) : "renderMode" in data && data.renderMode === "summary" ? (
            <SummaryAggregatePreview model={data.summaryModel} printMode />
          ) : (
            <div className="mx-auto max-w-[794px] rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500 shadow-sm">
              ไม่สามารถแสดงเอกสารได้
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReportExportFallback() {
  return (
    <div className="min-h-screen bg-slate-100 px-2 py-3 text-slate-900 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-[794px] rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500 shadow-sm">
        กำลังเตรียมหน้า export...
      </div>
    </div>
  );
}

export default function ReportExportPage() {
  return (
    <Suspense fallback={<ReportExportFallback />}>
      <ReportExportContent />
    </Suspense>
  );
}