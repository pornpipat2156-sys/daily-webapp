"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ReportPreviewForm,
  type IssueRowUnified,
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
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm transition-colors dark:border-slate-800 dark:bg-slate-950/95">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
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
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
      )}
    >
      {children}
    </button>
  );
}

function PreviewStateBox({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border px-6 py-12 text-center text-sm font-medium shadow-sm transition-colors",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
      )}
    >
      {children}
    </div>
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
  result: Exclude<BrowserResponse, ErrorResponse | NotFoundResponse | null>
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

function formatDateTimeThai(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderInputIssueCommentCell(issue: IssueRowUnified) {
  const comments = Array.isArray(issue?.comments) ? issue.comments : [];

  if (!comments.length) {
    return (
      <div className="text-sm opacity-60">
        ยังไม่มีความคิดเห็น
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {comments.map((comment) => {
        const authorName =
          comment.author?.name?.trim() ||
          comment.author?.email?.trim() ||
          "ผู้แสดงความคิดเห็น";
        const authorRole = comment.author?.role?.trim() || "";

        return (
          <div
            key={comment.id}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
          >
            <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-100">
              {comment.comment || "-"}
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              {authorName}
              {authorRole ? ` (${authorRole})` : ""} •{" "}
              {formatDateTimeThai(comment.createdAt)}
            </div>
          </div>
        );
      })}
    </div>
  );
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
        const contentType = res.headers.get("Content-Type") || "";

        if (contentType.includes("application/json")) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.message || "ดาวน์โหลด PDF ไม่สำเร็จ");
        }

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
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-6 shadow-sm transition-colors dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Report Center
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Summary & PDF Preview
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
            เลือกโครงการและเลือกรอบรายงานจากข้อมูลในระบบ เพื่อดู Preview และดาวน์โหลด
            PDF แบบ A4 โดยตรงจากระบบ
          </p>
        </section>

        <SectionCard
          title="ตัวเลือกการแสดงผล"
          subtitle="ตั้งค่าการเลือกโครงการ ประเภทรายงาน และรอบเอกสารก่อนแสดง Preview"
        >
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div>
              <FieldLabel>โครงการ</FieldLabel>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loadingProjects || projects.length === 0}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-700 dark:focus:ring-slate-800 dark:disabled:bg-slate-900"
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
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-700 dark:focus:ring-slate-800 dark:disabled:bg-slate-900"
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
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors dark:border-slate-800 dark:bg-slate-900/60 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-400">
              Daily จะแสดงเฉพาะรายงานที่ผ่านการอนุมัติครบแล้วเท่านั้น ส่วน Weekly และ
              Monthly จะแสดงตามข้อมูลที่มีอยู่ใน DB
            </p>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!canExport || loadingDownload}
              className={cn(
                "inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-semibold transition focus:outline-none focus:ring-2",
                canExport && !loadingDownload
                  ? "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-700"
                  : "cursor-not-allowed bg-slate-200 text-slate-500 focus:ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:focus:ring-slate-800"
              )}
            >
              {loadingDownload ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Preview"
          subtitle="ตรวจสอบเอกสารก่อนดาวน์โหลด เพื่อให้ตรงกับข้อมูลจริงในระบบ"
        >
          {!projectId ? (
            <PreviewStateBox>กรุณาเลือกโครงการก่อน</PreviewStateBox>
          ) : loadingPreview ? (
            <PreviewStateBox>กำลังโหลด Preview...</PreviewStateBox>
          ) : !result ? (
            <PreviewStateBox>ยังไม่มีข้อมูลสำหรับแสดงผล</PreviewStateBox>
          ) : "ok" in result && result.ok === false ? (
            <PreviewStateBox tone="error">
              {result.message || "เกิดข้อผิดพลาด"}
            </PreviewStateBox>
          ) : "found" in result && result.found === false ? (
            <PreviewStateBox>{result.message || "ไม่พบรายงาน"}</PreviewStateBox>
          ) : "renderMode" in result && result.renderMode === "daily" ? (
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-950">
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  <ReportPreviewForm
                    model={result.dailyModel}
                    renderIssueCommentCell={(issue) =>
                      renderInputIssueCommentCell(issue)
                    }
                  />
                </div>
              </div>
            </div>
          ) : "renderMode" in result && result.renderMode === "summary" ? (
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-950">
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  <SummaryAggregatePreview model={result.summaryModel} />
                </div>
              </div>
            </div>
          ) : (
            <PreviewStateBox>ไม่สามารถแสดง Preview ได้</PreviewStateBox>
          )}
        </SectionCard>
      </div>
    </main>
  );
}