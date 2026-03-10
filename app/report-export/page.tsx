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
    }, 400);

    return () => window.clearTimeout(timer);
  }, [auto, data]);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #ffffff;
        }

        body {
          color: #111111;
        }

        .export-root {
          min-height: 100vh;
          background: #ffffff;
        }

        .export-screen-actions {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #e5e7eb;
        }

        .export-print-btn {
          appearance: none;
          border: 1px solid #d1d5db;
          background: #111827;
          color: #ffffff;
          border-radius: 14px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .export-sheet {
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 16px 0 24px;
          background: #ffffff;
        }

        .export-sheet-inner {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          background: #ffffff;
        }

        .export-state {
          max-width: 794px;
          margin: 24px auto;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #ffffff;
          padding: 20px;
          color: #475569;
          font-size: 14px;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body,
          .export-root,
          .export-sheet,
          .export-sheet-inner {
            background: #ffffff !important;
          }

          .export-screen-actions {
            display: none !important;
          }

          .export-sheet {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .export-sheet-inner {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .export-state {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #111111 !important;
          }

          body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="export-root">
        <div className="export-screen-actions">
          <button
            type="button"
            onClick={() => window.print()}
            className="export-print-btn"
          >
            พิมพ์ / Save PDF
          </button>
        </div>

        <div className="export-sheet">
          <div className="export-sheet-inner">
            {loading ? (
              <div className="export-state">กำลังโหลดเอกสาร...</div>
            ) : !data ? (
              <div className="export-state">ไม่พบข้อมูล</div>
            ) : "ok" in data && data.ok === false ? (
              <div className="export-state">{data.message || "เกิดข้อผิดพลาด"}</div>
            ) : "found" in data && data.found === false ? (
              <div className="export-state">{data.message || "ไม่พบรายงาน"}</div>
            ) : "renderMode" in data && data.renderMode === "daily" ? (
              <ReportPreviewForm model={data.dailyModel} />
            ) : "renderMode" in data && data.renderMode === "summary" ? (
              <SummaryAggregatePreview model={data.summaryModel} printMode />
            ) : (
              <div className="export-state">ไม่สามารถแสดงเอกสารได้</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ReportExportFallback() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[794px] px-4 py-6 text-sm text-slate-500">
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