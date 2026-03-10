"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReportPreviewForm,
  type ReportRenderModel,
} from "@/components/ReportPreviewReadonly";
import {
  SummaryAggregatePreview,
  type SummaryDocumentModel,
} from "@/components/SummaryAggregatePreview";

type ProjectRow = {
  id: string;
  projectName: string;
};

type ReportType = "daily" | "weekly" | "monthly";

type PeriodOption = {
  id: string;
  value: string;
  label: string;
  meta?: Record<string, unknown>;
};

type DailyResponse = {
  ok: true;
  found: true;
  renderMode: "daily";
  reportType: "DAILY";
  reportId: string;
  documentTitle: string;
  projectId: string;
  projectName: string;
  selectedDate: string;
  periodLabel: string;
  dailyModel: ReportRenderModel;
};

type SummaryResponse = {
  ok: true;
  found: true;
  renderMode: "summary";
  reportType: "WEEKLY" | "MONTHLY";
  reportId: string;
  documentTitle: string;
  projectId: string;
  projectName: string;
  selectedDate: string;
  periodLabel: string;
  summaryModel: SummaryDocumentModel;
};

type NotFoundResponse = {
  ok: true;
  found: false;
  message: string;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

type BrowserResponse =
  | DailyResponse
  | SummaryResponse
  | NotFoundResponse
  | ErrorResponse
  | null;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_50px_rgba(148,163,184,0.14)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
      {children}
    </label>
  );
}

function TypeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition",
        active
          ? "bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.20)] dark:bg-slate-100 dark:text-slate-900"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      )}
    >
      {children}
    </button>
  );
}

function getPeriodLabel(type: ReportType) {
  if (type === "daily") return "รายงานประจำวันที่";
  if (type === "weekly") return "Week No. / Year";
  return "Month / Year";
}

function getEmptyOptionLabel(type: ReportType) {
  if (type === "daily") return "ไม่พบรายงานรายวัน";
  if (type === "weekly") return "ไม่พบรายงานรายสัปดาห์";
  return "ไม่พบรายงานรายเดือน";
}

function getSuggestedFileName(
  type: ReportType,
  result: Exclude<BrowserResponse, null>
) {
  const safeProject =
    "projectName" in result && result.projectName
      ? result.projectName.replace(/[\\/:*?"<>|]+/g, "-").trim()
      : "Report";

  if ("reportType" in result) {
    if (result.reportType === "DAILY") {
      return `${safeProject}-DailyReport.pdf`;
    }
    if (result.reportType === "WEEKLY") {
      return `${safeProject}-WeeklyReport.pdf`;
    }
    if (result.reportType === "MONTHLY") {
      return `${safeProject}-MonthlyReport.pdf`;
    }
  }

  if (type === "daily") return `${safeProject}-DailyReport.pdf`;
  if (type === "weekly") return `${safeProject}-WeeklyReport.pdf`;
  return `${safeProject}-MonthlyReport.pdf`;
}

function readFileNameFromDisposition(value: string | null) {
  if (!value) return null;

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const normalMatch = value.match(/filename="?([^"]+)"?/i);
  if (normalMatch?.[1]) {
    return normalMatch[1];
  }

  return null;
}

export default function InputPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [selectedPeriodValue, setSelectedPeriodValue] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [result, setResult] = useState<BrowserResponse>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setLoadingProjects(true);

      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const json = await res.json().catch(() => []);

        const list: ProjectRow[] = Array.isArray(json)
          ? json.map((item: any) => ({
              id: String(item?.id ?? ""),
              projectName: String(item?.projectName ?? "-"),
            }))
          : [];

        if (!cancelled) {
          setProjects(list);
          setProjectId((prev) => prev || list[0]?.id || "");
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
          setProjectId("");
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPeriodOptions() {
      setResult(null);
      setPeriodOptions([]);
      setSelectedPeriodValue("");

      if (!projectId) return;

      setLoadingPeriods(true);

      try {
        const qs = new URLSearchParams({
          projectId,
          type: reportType,
        });

        const res = await fetch(`/api/report-period-options?${qs.toString()}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({
          ok: false,
          items: [],
        }));

        const items: PeriodOption[] = Array.isArray(json?.items)
          ? json.items.map((item: any) => ({
              id: String(item?.id ?? ""),
              value: String(item?.value ?? ""),
              label: String(item?.label ?? "-"),
              meta:
                item?.meta &&
                typeof item.meta === "object" &&
                !Array.isArray(item.meta)
                  ? item.meta
                  : undefined,
            }))
          : [];

        if (!cancelled) {
          setPeriodOptions(items);
          setSelectedPeriodValue(items[0]?.value || "");
        }
      } catch {
        if (!cancelled) {
          setPeriodOptions([]);
          setSelectedPeriodValue("");
        }
      } finally {
        if (!cancelled) setLoadingPeriods(false);
      }
    }

    loadPeriodOptions();

    return () => {
      cancelled = true;
    };
  }, [projectId, reportType]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setResult(null);

      if (!projectId || !selectedPeriodValue) return;

      setLoadingPreview(true);

      try {
        const qs = new URLSearchParams({
          projectId,
          type: reportType,
          date: selectedPeriodValue,
        });

        const res = await fetch(`/api/report-browser?${qs.toString()}`, {
          cache: "no-store",
        });

        const json = await res.json().catch(() => ({
          ok: false,
          message: "โหลดข้อมูลไม่สำเร็จ",
        }));

        if (!cancelled) {
          setResult(json);
        }
      } catch (e: any) {
        if (!cancelled) {
          setResult({
            ok: false,
            message: String(e?.message || e || "โหลดข้อมูลไม่สำเร็จ"),
          });
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [projectId, selectedPeriodValue, reportType]);

  const canExport =
    result &&
    "ok" in result &&
    result.ok === true &&
    "found" in result &&
    result.found === true;

  const downloadFileName = useMemo(() => {
    if (!result || !canExport) {
      if (reportType === "daily") return "DailyReport.pdf";
      if (reportType === "weekly") return "WeeklyReport.pdf";
      return "MonthlyReport.pdf";
    }

    return getSuggestedFileName(reportType, result);
  }, [canExport, reportType, result]);

  async function handleDownloadPdf() {
    if (!projectId || !selectedPeriodValue || !canExport || !result) return;

    setLoadingDownload(true);

    try {
      const res = await fetch("/api/report-export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          type: reportType,
          date: selectedPeriodValue,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || "ดาวน์โหลด PDF ไม่สำเร็จ");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const dispositionName = readFileNameFromDisposition(
        res.headers.get("Content-Disposition")
      );

      const a = document.createElement("a");
      a.href = url;
      a.download = dispositionName || downloadFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(String(e?.message || e || "ดาวน์โหลด PDF ไม่สำเร็จ"));
    } finally {
      setLoadingDownload(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <div className="mb-6 rounded-[32px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-[0_20px_60px_rgba(148,163,184,0.18)] dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Report Center
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Summary & PDF Preview
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          เลือกโครงการและเลือกรอบรายงานจากข้อมูลในระบบ เพื่อดู Preview และดาวน์โหลด
          PDF แบบ A4 โดยตรงจากระบบ
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionCard
            title="ตัวกรองรายงาน"
            subtitle="เลือกโครงการ ประเภทรายงาน และรอบที่ต้องการแสดงผล"
          >
            <div className="space-y-5">
              <div>
                <FieldLabel>โครงการ</FieldLabel>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={loadingProjects || projects.length === 0}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-700 dark:focus:ring-slate-800"
                >
                  {loadingProjects ? (
                    <option>กำลังโหลดโครงการ...</option>
                  ) : projects.length === 0 ? (
                    <option>ไม่พบโครงการ</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <FieldLabel>ประเภทรายงาน</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  <TypeButton
                    active={reportType === "daily"}
                    onClick={() => setReportType("daily")}
                  >
                    Daily
                  </TypeButton>
                  <TypeButton
                    active={reportType === "weekly"}
                    onClick={() => setReportType("weekly")}
                  >
                    Weekly
                  </TypeButton>
                  <TypeButton
                    active={reportType === "monthly"}
                    onClick={() => setReportType("monthly")}
                  >
                    Monthly
                  </TypeButton>
                </div>
              </div>

              <div>
                <FieldLabel>{getPeriodLabel(reportType)}</FieldLabel>
                <select
                  value={selectedPeriodValue}
                  onChange={(e) => setSelectedPeriodValue(e.target.value)}
                  disabled={!projectId || loadingPeriods || periodOptions.length === 0}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-700 dark:focus:ring-slate-800"
                >
                  {!projectId ? (
                    <option>เลือกโครงการก่อน</option>
                  ) : loadingPeriods ? (
                    <option>กำลังโหลดรายการ...</option>
                  ) : periodOptions.length === 0 ? (
                    <option>{getEmptyOptionLabel(reportType)}</option>
                  ) : (
                    periodOptions.map((item) => (
                      <option key={item.id} value={item.value}>
                        {item.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                Daily จะแสดงเฉพาะรายงานที่ผ่านการอนุมัติครบแล้วเท่านั้น ส่วน Weekly
                และ Monthly จะแสดงตามข้อมูลที่มีอยู่ใน DB
              </div>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!canExport || loadingDownload}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {loadingDownload ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
              </button>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Preview"
          subtitle="แสดงผลข้อมูลแบบ A4 ตามรายงานที่เลือก"
        >
          {!projectId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              กรุณาเลือกโครงการก่อน
            </div>
          ) : loadingPreview ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              กำลังโหลด Preview...
            </div>
          ) : !result ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              ยังไม่มีข้อมูลสำหรับแสดงผล
            </div>
          ) : "ok" in result && result.ok === false ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-10 text-center text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {result.message || "เกิดข้อผิดพลาด"}
            </div>
          ) : "found" in result && result.found === false ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              {result.message || "ไม่พบรายงาน"}
            </div>
          ) : "renderMode" in result && result.renderMode === "daily" ? (
            <ReportPreviewForm model={result.dailyModel} />
          ) : "renderMode" in result && result.renderMode === "summary" ? (
            <SummaryAggregatePreview model={result.summaryModel} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
              ไม่สามารถแสดง Preview ได้
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}