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
  return typeof value === "string" ? value : fallback;
}

function buildWeeklyModelFromSummary(
  result: SummaryResponse
): WeeklyReportModel | null {
  if (result.reportType !== "WEEKLY") return null;

  const model: any = result.summaryModel ?? {};
  const meta: any = model.meta ?? model.summary ?? model.header ?? {};
  const project: any = model.project ?? {};
  const period: any = model.period ?? {};
  const timeSummary: any = model.timeSummary ?? model.durationSummary ?? {};
  const safety: any = model.safety ?? {};
  const progressSource: any[] = toArray<any>(
    model.progressByCategory ??
      model.progressItems ??
      model.progressSummary ??
      model.categories
  );
  const workSource: any[] = toArray<any>(
    model.workPerformedWeekly ??
      model.workItems ??
      model.mergedWorkItems ??
      model.items ??
      model.works
  );
  const problemSource: any[] = toArray<any>(
    model.problemsAndObstacles ?? model.problems ?? model.issues ?? model.obstacles
  );
  const supervisorSource: any[] = toArray<any>(
    model.supervisors ?? model.signatures ?? model.approvals ?? model.reviewers
  );

  const normalizedWork: WeeklyWorkItem[] = workSource.map((item, index) => ({
    id: String(item?.id ?? `work-${index + 1}`),
    description: toText(
      item?.description ??
        item?.desc ??
        item?.title ??
        item?.workDescription ??
        item?.name,
      "-"
    ),
    location: toText(item?.location ?? item?.area ?? item?.position, ""),
    qty:
      item?.qty == null && item?.quantity == null
        ? null
        : toNumber(item?.qty ?? item?.quantity, 0),
    unit: toText(item?.unit, ""),
    remark: toText(item?.remark ?? item?.materialDelivered ?? item?.note, ""),
  }));

  const normalizedProblems: WeeklyProblemItem[] = problemSource.map(
    (item, index) => ({
      id: String(item?.id ?? `problem-${index + 1}`),
      topic: toText(item?.topic ?? item?.title ?? item?.issue ?? item?.problem, "-"),
      impact: toText(item?.impact ?? item?.effect ?? item?.comment, ""),
      solution: toText(item?.solution ?? item?.resolution ?? item?.action, ""),
    })
  );

  const normalizedProgress: WeeklyProgressItem[] = progressSource.map(
    (item, index) => ({
      id: String(item?.id ?? `progress-${index + 1}`),
      category: toText(
        item?.category ?? item?.name ?? item?.title ?? item?.workCategory,
        "-"
      ),
      weightPercent: toNumber(item?.weightPercent ?? item?.weight ?? item?.weightPct, 0),
      previousPercent: toNumber(
        item?.previousPercent ?? item?.prevPercent ?? item?.beforePercent,
        0
      ),
      weeklyPercent: toNumber(
        item?.weeklyPercent ?? item?.thisWeekPercent ?? item?.currentPercent,
        0
      ),
      accumulatedPercent: toNumber(
        item?.accumulatedPercent ?? item?.actualPercent ?? item?.cumulativePercent,
        0
      ),
      remainingPercent: toNumber(
        item?.remainingPercent ?? item?.remainPercent ?? item?.balancePercent,
        0
      ),
      plannedPercent:
        item?.plannedPercent == null && item?.planPercent == null
          ? null
          : toNumber(item?.plannedPercent ?? item?.planPercent, 0),
      variancePercent:
        item?.variancePercent == null && item?.diffPercent == null
          ? null
          : toNumber(item?.variancePercent ?? item?.diffPercent, 0),
      amountTotal:
        item?.amountTotal == null ? null : toNumber(item?.amountTotal, 0),
      amountAccumulated:
        item?.amountAccumulated == null
          ? null
          : toNumber(item?.amountAccumulated, 0),
      amountRemaining:
        item?.amountRemaining == null ? null : toNumber(item?.amountRemaining, 0),
    })
  );

  const normalizedSupervisors: WeeklySupervisor[] = supervisorSource.map((item) => ({
    name: toText(item?.name ?? item?.fullName, ""),
    role: toText(item?.role ?? item?.position ?? item?.title, ""),
  }));

  return {
    id: result.reportId,
    projectId: result.projectId,
    year: toNumber(meta?.year ?? period?.year ?? 0, 0),
    weekNo: toNumber(meta?.weekNo ?? period?.weekNo ?? 0, 0),
    startDate: toText(
      meta?.startDate ?? period?.startDate ?? result.selectedDate,
      result.selectedDate
    ),
    endDate: toText(meta?.endDate ?? period?.endDate ?? result.selectedDate, result.selectedDate),
    title: toText(
      model?.documentTitle ??
        model?.title ??
        result.documentTitle ??
        `Weekly Report - ${result.periodLabel}`,
      `Weekly Report - ${result.periodLabel}`
    ),
    summary: {
      projectName: toText(
        project?.projectName ?? meta?.projectName ?? result.projectName,
        result.projectName
      ),
      contractNo: toText(meta?.contractNo ?? meta?.contractNumber, "-"),
      installmentLabel: toText(
        meta?.installmentLabel ?? meta?.periodNo ?? result.periodLabel,
        result.periodLabel
      ),
      contractorName: toText(meta?.contractorName ?? meta?.contractor, "-"),
      siteLocation: toText(meta?.siteLocation ?? meta?.location, "-"),
      contractStart: toText(meta?.contractStart ?? meta?.startContractDate, ""),
      contractEnd: toText(meta?.contractEnd ?? meta?.endContractDate, ""),
      contractValue: toText(meta?.contractValue ?? meta?.projectValue, "-"),
      procurementMethod: toText(meta?.procurementMethod ?? meta?.purchaseMethod, "-"),
      periodNo: toText(meta?.periodNo, ""),
    },
    timeSummary: {
      contractDays: toNumber(timeSummary?.contractDays ?? timeSummary?.totalDays, 0),
      previousUsedDays: toNumber(
        timeSummary?.previousUsedDays ?? timeSummary?.usedDaysBefore,
        0
      ),
      currentWeekDays: toNumber(
        timeSummary?.currentWeekDays ?? timeSummary?.thisWeekDays,
        0
      ),
      accumulatedDays: toNumber(
        timeSummary?.accumulatedDays ?? timeSummary?.usedDaysAccumulated,
        0
      ),
      remainingDays: toNumber(
        timeSummary?.remainingDays ?? timeSummary?.daysRemaining,
        0
      ),
      plannedDays:
        timeSummary?.plannedDays == null ? null : toNumber(timeSummary?.plannedDays, 0),
      varianceDays:
        timeSummary?.varianceDays == null ? null : toNumber(timeSummary?.varianceDays, 0),
    } satisfies WeeklyTimeSummary,
    workPerformedWeekly: normalizedWork,
    comments: toText(
      model?.comments ??
        model?.comment ??
        model?.inspectorComment ??
        model?.supervisorComment ??
        "",
      ""
    ),
    problemsAndObstacles: normalizedProblems,
    safety: {
      note: toText(safety?.note ?? safety?.remark ?? safety?.summary, ""),
      accidentCount:
        safety?.accidentCount == null ? 0 : toNumber(safety?.accidentCount, 0),
      injuredCount:
        safety?.injuredCount == null ? 0 : toNumber(safety?.injuredCount, 0),
      lostTimeCount:
        safety?.lostTimeCount == null ? 0 : toNumber(safety?.lostTimeCount, 0),
    },
    progressByCategory: normalizedProgress,
    supervisors: normalizedSupervisors,
    createdAt: toText(model?.createdAt, ""),
    updatedAt: toText(model?.updatedAt, ""),
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