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
    <section className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-5 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(30,41,59,0.96))] dark:shadow-[0_24px_70px_rgba(2,6,23,0.42)] sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
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
        "inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.20)] dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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

export default function InputPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [periodOptions, setPeriodOptions] = useState<PeriodOption[]>([]);
  const [selectedPeriodValue, setSelectedPeriodValue] = useState("");

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
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
                item?.meta && typeof item.meta === "object" && !Array.isArray(item.meta)
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

  const pdfUrl = useMemo(() => {
    if (!projectId || !selectedPeriodValue) return "";
    const qs = new URLSearchParams({
      projectId,
      type: reportType,
      date: selectedPeriodValue,
      auto: "1",
    });
    return `/report-export?${qs.toString()}`;
  }, [projectId, selectedPeriodValue, reportType]);

  const canExport =
    result &&
    "ok" in result &&
    result.ok === true &&
    "found" in result &&
    result.found === true;

  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 px-3 py-3 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,rgba(240,244,255,0.96),rgba(236,249,245,0.90),rgba(255,244,246,0.92))] p-6 shadow-[0_24px_80px_rgba(148,163,184,0.16)] backdrop-blur dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(30,41,59,0.96))] dark:shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.34em] text-slate-400 dark:text-slate-500">
                Report Center
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
                Summary &amp; PDF Preview
              </h1>
              <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
                เลือกโครงการและเลือกรอบรายงานจากข้อมูลในระบบ เพื่อดู Preview
                และเปิดเอกสาร A4 สำหรับดาวน์โหลด PDF
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canExport}
                onClick={() => {
                  if (!pdfUrl) return;
                  window.open(pdfUrl, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(148,163,184,0.14)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                ดาวน์โหลด PDF
              </button>
            </div>
          </div>
        </section>

        <SectionCard
          title="เลือกข้อมูลรายงาน"
          subtitle="Daily เลือกจากรายงานประจำวันที่มีในระบบ / Weekly และ Monthly เลือกตามรายการที่มีใน DB"
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1.2fr_1.1fr]">
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
                    <option key={`${item.id}-${item.value}`} value={item.value}>
                      {item.label}
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
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300">
            Daily จะแสดงเฉพาะรายงานที่ผ่านการอนุมัติครบแล้วเท่านั้น ส่วน Weekly และ
            Monthly จะแสดงตามข้อมูลที่มีอยู่ใน DB
          </div>
        </SectionCard>

        <SectionCard
          title="Preview"
          subtitle="พื้นที่แสดงเฉพาะรายงานที่เลือก และใช้เป็นต้นทางสำหรับ PDF ขนาด A4"
        >
          {!projectId ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
              กรุณาเลือกโครงการก่อน
            </div>
          ) : loadingPreview ? (
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
              กำลังโหลด Preview...
            </div>
          ) : !result ? (
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
              ยังไม่มีข้อมูลสำหรับแสดงผล
            </div>
          ) : "ok" in result && result.ok === false ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
              {result.message || "เกิดข้อผิดพลาด"}
            </div>
          ) : "found" in result && result.found === false ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
              {result.message || "ไม่พบรายงาน"}
            </div>
          ) : "renderMode" in result && result.renderMode === "daily" ? (
            <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-2 shadow-[0_18px_50px_rgba(148,163,184,0.08)] dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-[0_20px_60px_rgba(2,6,23,0.32)] sm:p-3">
              <ReportPreviewForm model={result.dailyModel} />
            </div>
          ) : "renderMode" in result && result.renderMode === "summary" ? (
            <SummaryAggregatePreview model={result.summaryModel} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
              ไม่สามารถแสดง Preview ได้
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}