"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportPreviewReadonly } from "@/components/ReportPreviewReadonly";

type PreviewMeta = {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDateBE(iso?: string) {
  if (!iso) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
  }

  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;

  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(
    2,
    "0"
  )}/${dt.getFullYear() + 543}`;
}

function StatCard({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "blue" | "mint" | "pink" | "amber" | "violet";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300"
      : tone === "pink"
      ? "bg-[rgba(247,199,217,0.18)] text-rose-700 dark:text-rose-300"
      : tone === "amber"
      ? "bg-[rgba(243,190,114,0.18)] text-amber-700 dark:text-amber-300"
      : tone === "violet"
      ? "bg-[rgba(154,135,245,0.18)] text-violet-700 dark:text-violet-300"
      : "bg-[rgba(124,156,245,0.16)] text-blue-700 dark:text-blue-300";

  return (
    <div className={cn("rounded-[22px] px-4 py-3", toneClass)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{label}</div>
      <div className="mt-1 text-sm font-bold break-words">{value}</div>
    </div>
  );
}

export default function PreviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reportId, setReportId] = useState("");
  const [meta, setMeta] = useState<PreviewMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [err, setErr] = useState("");

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

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setErr("");
      setMeta(null);

      if (!reportId) return;

      setLoadingMeta(true);
      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok || !json?.report) {
          throw new Error(json?.message || "โหลด preview ไม่สำเร็จ");
        }

        const report = json.report;

        if (!cancelled) {
          setMeta({
            id: String(report?.id ?? reportId),
            projectId: String(report?.projectId ?? ""),
            projectName: String(report?.projectName ?? "-"),
            date: String(report?.date ?? ""),
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(String(e?.message || e));
        }
      } finally {
        if (!cancelled) {
          setLoadingMeta(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const canRender = useMemo(() => Boolean(reportId && !loadingMeta && !err), [reportId, loadingMeta, err]);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-8 sm:px-4 lg:px-6">
      <div className="mb-5 rounded-[30px] bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.14),rgba(247,199,217,0.16))] p-5 shadow-[0_14px_38px_rgba(148,163,184,0.10)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Preview
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Daily report preview
            </h1>
            <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/daily-report")}
              className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/80 bg-white/88 px-4 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/60 dark:text-slate-200"
            >
              กลับไปแก้ไข
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
            >
              พิมพ์ / Save PDF
            </button>
          </div>
        </div>
      </div>

      {!reportId ? (
        <div className="soft-card rounded-[26px] px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
          ไม่พบ reportId สำหรับเปิด Preview
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Report ID" value={reportId} tone="blue" />
            <StatCard label="Project" value={meta?.projectName || "-"} tone="mint" />
            <StatCard label="วันที่รายงาน" value={meta?.date ? formatDateBE(meta.date) : "-"} tone="pink" />
            <StatCard label="สถานะ" value={loadingMeta ? "กำลังโหลด..." : err ? "เกิดข้อผิดพลาด" : "พร้อมแสดงผล"} tone={loadingMeta ? "amber" : err ? "amber" : "violet"} />
          </div>

          {err ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
              {err}
            </div>
          ) : !canRender ? (
            <div className="soft-card rounded-[26px] px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
              กำลังเตรียมข้อมูล Preview...
            </div>
          ) : (
            <div className="soft-card rounded-[26px] p-3 sm:p-4 lg:p-5">
              <ReportPreviewReadonly reportId={reportId} />
            </div>
          )}
        </>
      )}
    </div>
  );
}