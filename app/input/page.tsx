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
import {
  WeeklyReportForm,
  type WeeklyProgressItem,
  type WeeklyProblemItem,
  type WeeklyReportModel,
  type WeeklySupervisor,
  type WeeklyTimeSummary,
  type WeeklyWorkItem,
} from "@/components/WeeklyReportForm";

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
    <section className="overflow-hidden rounded-[28px] border border-[#244a86]/70 bg-[radial-gradient(circle_at_top,rgba(18,52,115,0.32),rgba(2,8,23,0.96))] shadow-[0_20px_60px_rgba(2,8,23,0.45)] backdrop-blur">
      <div className="border-b border-[#244a86]/70 px-6 py-5 md:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-2 text-sm text-slate-200 md:text-base">{subtitle}</p>
        ) : null}
      </div>
      <div className="px-4 py-5 md:px-6 md:py-6">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-sm font-semibold text-slate-200">{children}</div>
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
        "h-12 rounded-2xl px-5 text-sm font-semibold transition",
        active
          ? "bg-white text-slate-900 shadow-[0_10px_30px_rgba(255,255,255,0.18)]"
          : "border border-[#244a86]/70 bg-slate-950/40 text-slate-200 hover:bg-slate-900/70"
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
        "rounded-[24px] border px-5 py-8 text-center text-sm md:text-base",
        tone === "error"
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
          : "border-[#244a86]/70 bg-slate-950/40 text-slate-300"
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
  result: Exclude<BrowserResponse, null | ErrorResponse | NotFoundResponse>
) {
  const safeProject =
    "projectName" in result && result.projectName
      ? result.projectName.replace(/[\\/:*?"<>|]+/g, "-").trim()
      : "Report";

  if ("reportType" in result) {
    if (result.reportType === "DAILY") return `${safeProject}-DailyReport.pdf`;
    if (result.reportType === "WEEKLY") return `${safeProject}-WeeklyReport.pdf`;
    if (result.reportType === "MONTHLY") return `${safeProject}-MonthlyReport.pdf`;
  }

  if (type === "daily") return `${safeProject}-DailyReport.pdf`;
  if (type === "weekly") return `${safeProject}-WeeklyReport.pdf`;
  return `${safeProject}-MonthlyReport.pdf`;
}

function readFileNameFromDisposition(value: string | null) {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const normalMatch = value.match(/filename="?([^"]+)"?/i);
  if (normalMatch?.[1]) return normalMatch[1];
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
    return <div className="text-slate-500">ยังไม่มีความคิดเห็น</div>;
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
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
              {comment.comment || "-"}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toText(value: unknown, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function buildWeeklyModelFromSummary(
  result: SummaryResponse
): WeeklyReportModel | null {
  if (result.reportType !== "WEEKLY") return null;

  const model = (result.summaryModel ?? {}) as Record<string, unknown>;

  const payload = toRecord(model.payload) ?? {};
  const projectMeta =
    toRecord(payload.projectMeta) ??
    toRecord(model.projectMeta) ??
    {};

  const timeSummary = toRecord(payload.timeSummary) ?? {};
  const safety = toRecord(payload.safety) ?? {};

    const workSource = toArray<Record<string, unknown>>(payload.mergedWorkItems);
    const problemSource = toArray<unknown>(payload.normalizedIssues);
    const progressSource = toArray<Record<string, unknown>>(payload.progressByCategory);
    const supervisorSource = toArray<Record<string, unknown>>(payload.supervisors);
    const projectSupervisorNames = toArray<unknown>(projectMeta.supervisors)
      .map((item) => toText(item, ""))
      .filter(Boolean);

  const normalizedWork: WeeklyWorkItem[] = workSource.map((item, index) => ({
    id: String(item.id ?? `work-${index + 1}`),
    description: toText(item.desc, "-"),
    location: toText(item.location, ""),
    qty:
      item.qtyTotal == null || String(item.qtyTotal).trim() === ""
        ? null
        : toNumber(item.qtyTotal, 0),
    unit: toText(item.unit, ""),
    remark: toText(item.materialDelivered, ""),
  }));

  const normalizedProblems: WeeklyProblemItem[] = problemSource.map((item, index) => ({
    id: `problem-${index + 1}`,
    topic: toText(item, "-"),
    impact: "",
    solution: "",
  }));

  const normalizedProgress: WeeklyProgressItem[] = progressSource.map((item, index) => ({
    id: String(item.id ?? `progress-${index + 1}`),
    category: toText(item.category, `หมวดงาน ${index + 1}`),
    weightPercent: toNumber(item.weightPercent, 0),
    previousPercent: toNumber(item.previousPercent, 0),
    weeklyPercent: toNumber(item.weeklyPercent, 0),
    accumulatedPercent: toNumber(item.accumulatedPercent, 0),
    remainingPercent: toNumber(item.remainingPercent, 0),
    plannedPercent:
      item.plannedPercent == null || String(item.plannedPercent).trim() === ""
        ? null
        : toNumber(item.plannedPercent, 0),
    variancePercent:
      item.variancePercent == null || String(item.variancePercent).trim() === ""
        ? null
        : toNumber(item.variancePercent, 0),
    amountTotal:
      item.amountTotal == null || String(item.amountTotal).trim() === ""
        ? null
        : toNumber(item.amountTotal, 0),
    amountAccumulated:
      item.amountAccumulated == null || String(item.amountAccumulated).trim() === ""
        ? null
        : toNumber(item.amountAccumulated, 0),
    amountRemaining:
      item.amountRemaining == null || String(item.amountRemaining).trim() === ""
        ? null
        : toNumber(item.amountRemaining, 0),
  }));

    const normalizedSupervisors: WeeklySupervisor[] = (
    supervisorSource.length > 0
      ? supervisorSource.map((item) => ({
          name: toText(item.name, ""),
          role: toText(item.role, "ผู้ควบคุมงาน"),
        }))
      : projectSupervisorNames.map((name) => ({
          name,
          role: "ผู้ควบคุมงาน",
        }))
  ).filter((item) => item.name || item.role);

  const payloadDateStart = toText(payload.dateStart, "");
  const payloadDateEnd = toText(payload.dateEnd, "");
  const yearFromDate =
    payloadDateStart && !Number.isNaN(new Date(payloadDateStart).getTime())
      ? new Date(payloadDateStart).getFullYear()
      : new Date(result.selectedDate).getFullYear();

  // DIRECT WEEKLY INPUT PREVIEW BUILD
  return {
    id: result.reportId,
    projectId: result.projectId,
    year: toNumber(payload.year, yearFromDate),
    weekNo: toNumber(payload.weekNo, 0),
    startDate: payloadDateStart || result.selectedDate,
    endDate: payloadDateEnd || result.selectedDate,
    title: toText(
      (model.title as string | null) ??
        (model.documentTitle as string | null) ??
        result.documentTitle,
      result.documentTitle
    ),
    summary: {
      projectName: toText(projectMeta.projectName, result.projectName),
      contractNo: toText(projectMeta.contractNo, "-"),
      installmentLabel: toText(projectMeta.periodNo, "-"),
      contractorName: toText(projectMeta.contractorName, "-"),
      siteLocation: toText(projectMeta.siteLocation, "-"),
      contractStart: toText(projectMeta.contractStart, "-"),
      contractEnd: toText(projectMeta.contractEnd, "-"),
      contractValue: toText(projectMeta.contractValue, "-"),
      procurementMethod: toText(projectMeta.procurementMethod, "-"),
      periodNo: toText(projectMeta.periodNo, ""),
    },
    timeSummary: {
      contractDays: toNumber(timeSummary.contractDays, 0),
      previousUsedDays: toNumber(timeSummary.previousUsedDays, 0),
      currentWeekDays: toNumber(timeSummary.currentWeekDays, 0),
      accumulatedDays: toNumber(timeSummary.accumulatedDays, 0),
      remainingDays: toNumber(timeSummary.remainingDays, 0),
      plannedDays:
        timeSummary.plannedDays == null || String(timeSummary.plannedDays).trim() === ""
          ? null
          : toNumber(timeSummary.plannedDays, 0),
      varianceDays:
        timeSummary.varianceDays == null || String(timeSummary.varianceDays).trim() === ""
          ? null
          : toNumber(timeSummary.varianceDays, 0),
    } satisfies WeeklyTimeSummary,
    workPerformedWeekly: normalizedWork,
    comments: toText(model.summary, "-"),
    problemsAndObstacles: normalizedProblems,
    safety: {
      note: toText(safety.note, "-"),
      accidentCount: toNumber(safety.accidentCount, 0),
      injuredCount: toNumber(safety.injuredCount, 0),
      lostTimeCount: toNumber(safety.lostTimeCount, 0),
    },
    progressByCategory: normalizedProgress,
    supervisors: normalizedSupervisors,
    createdAt: toText(payload.createdAt ?? model.createdAt, ""),
    updatedAt: toText(payload.updatedAt ?? model.updatedAt, ""),
  };
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
        const qs = new URLSearchParams({ projectId, type: reportType });
        const res = await fetch(`/api/report-period-options?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({ ok: false, items: [] }));

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

  const weeklyPreviewModel = useMemo(() => {
    if (!result) return null;
    if (!("ok" in result) || !result.ok) return null;
    if (!("found" in result) || !result.found) return null;
    if (!("renderMode" in result) || result.renderMode !== "summary") return null;
    if (result.reportType !== "WEEKLY") return null;
    return buildWeeklyModelFromSummary(result);
  }, [result]);

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.16),transparent_28%),linear-gradient(180deg,#020817,#071226_38%,#020817)] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <SectionCard
          title="Report Center"
          subtitle="เลือกโครงการและเลือกรอบรายงานจากข้อมูลในระบบ เพื่อดู Preview และดาวน์โหลด PDF แบบ A4 โดยตรงจากระบบ"
        >
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_auto]">
            <div>
              <FieldLabel>โครงการ</FieldLabel>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loadingProjects || projects.length === 0}
                className="h-12 w-full rounded-2xl border border-[#244a86]/70 bg-slate-950/60 px-4 text-sm font-medium text-slate-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-950/30"
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
              <div className="grid h-12 grid-cols-3 gap-2">
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
                className="h-12 w-full rounded-2xl border border-[#244a86]/70 bg-slate-950/60 px-4 text-sm font-medium text-slate-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-950/30"
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

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!canExport || loadingDownload}
                className="h-12 w-full rounded-2xl bg-white px-5 text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 xl:w-auto"
              >
                {loadingDownload ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#244a86]/60 bg-slate-950/35 px-4 py-3 text-sm text-slate-300">
            Daily จะแสดงเฉพาะรายงานที่ผ่านการอนุมัติครบแล้วเท่านั้น ส่วน Weekly และ
            Monthly จะแสดงตามข้อมูลที่มีอยู่ใน DB
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
            <ReportPreviewForm
              model={result.dailyModel}
              renderIssueCommentCell={renderInputIssueCommentCell}
            />
          ) : "renderMode" in result &&
            result.renderMode === "summary" &&
            result.reportType === "WEEKLY" ? (
            <WeeklyReportForm model={weeklyPreviewModel} />
          ) : "renderMode" in result && result.renderMode === "summary" ? (
            <SummaryAggregatePreview model={result.summaryModel} />
          ) : (
            <PreviewStateBox>ไม่สามารถแสดง Preview ได้</PreviewStateBox>
          )}
        </SectionCard>
      </div>
    </main>
  );
}