"use client";

import { useEffect, useMemo, useState } from "react";
import WeeklyReportForm, {
  type WeeklyProgressItem,
  type WeeklyProblemItem,
  type WeeklyProjectSummary,
  type WeeklyReportModel,
  type WeeklySafetySummary,
  type WeeklySupervisor,
  type WeeklyTimeSummary,
  type WeeklyWorkItem,
} from "@/components/WeeklyReportForm";

type ProjectRow = {
  id: string;
  projectName: string;
};

type WeeklyListRow = {
  id: string;
  title: string;
  weekNo: number;
  year: number;
  startDate: string;
  endDate: string;
};

type ApiWeeklyReport = {
  id: string;
  projectId: string;
  year: number;
  weekNo: number;
  startDate: string;
  endDate: string;
  title?: string | null;
  summary?: WeeklyProjectSummary | null;
  timeSummary?: WeeklyTimeSummary | null;
  workPerformedWeekly?: WeeklyWorkItem[] | null;
  comments?: string | null;
  problemsAndObstacles?: WeeklyProblemItem[] | null;
  safety?: WeeklySafetySummary | null;
  progressByCategory?: WeeklyProgressItem[] | null;
  supervisors?: WeeklySupervisor[] | null;
  createdAt?: string;
  updatedAt?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeWeeklyReport(input: ApiWeeklyReport | null | undefined): WeeklyReportModel | null {
  if (!input?.id || !input?.projectId) return null;

  return {
    id: String(input.id),
    projectId: String(input.projectId),
    year: Number(input.year || 0),
    weekNo: Number(input.weekNo || 0),
    startDate: String(input.startDate || ""),
    endDate: String(input.endDate || ""),
    title: String(input.title || `Weekly Report - Week ${Number(input.weekNo || 0)}`),
    summary: {
      projectName: String(input.summary?.projectName || "-"),
      contractNo: String(input.summary?.contractNo || "-"),
      installmentLabel: String(input.summary?.installmentLabel || "-"),
      contractorName: String(input.summary?.contractorName || "-"),
      siteLocation: String(input.summary?.siteLocation || "-"),
      contractStart: String(input.summary?.contractStart || ""),
      contractEnd: String(input.summary?.contractEnd || ""),
      contractValue: String(input.summary?.contractValue || "-"),
      procurementMethod: String(input.summary?.procurementMethod || "-"),
      periodNo: String(input.summary?.periodNo || "-"),
    },
    timeSummary: {
      contractDays: Number(input.timeSummary?.contractDays || 0),
      previousUsedDays: Number(input.timeSummary?.previousUsedDays || 0),
      currentWeekDays: Number(input.timeSummary?.currentWeekDays || 0),
      accumulatedDays: Number(input.timeSummary?.accumulatedDays || 0),
      remainingDays: Number(input.timeSummary?.remainingDays || 0),
      plannedDays:
        input.timeSummary?.plannedDays == null ? null : Number(input.timeSummary.plannedDays),
      varianceDays:
        input.timeSummary?.varianceDays == null ? null : Number(input.timeSummary.varianceDays),
    },
    workPerformedWeekly: toArray<WeeklyWorkItem>(input.workPerformedWeekly).map((item, index) => ({
      id: String(item?.id || `work-${index + 1}`),
      description: String(item?.description || ""),
      qty: item?.qty == null ? null : Number(item.qty),
      unit: item?.unit ?? "",
      location: item?.location ?? "",
      remark: item?.remark ?? "",
    })),
    comments: String(input.comments || ""),
    problemsAndObstacles: toArray<WeeklyProblemItem>(input.problemsAndObstacles).map(
      (item, index) => ({
        id: String(item?.id || `problem-${index + 1}`),
        topic: String(item?.topic || ""),
        impact: item?.impact ?? "",
        solution: item?.solution ?? "",
      })
    ),
    safety: {
      note: String(input.safety?.note || ""),
      accidentCount:
        input.safety?.accidentCount == null ? 0 : Number(input.safety.accidentCount),
      injuredCount: input.safety?.injuredCount == null ? 0 : Number(input.safety.injuredCount),
      lostTimeCount:
        input.safety?.lostTimeCount == null ? 0 : Number(input.safety.lostTimeCount),
    },
    progressByCategory: toArray<WeeklyProgressItem>(input.progressByCategory).map(
      (item, index) => ({
        id: String(item?.id || `progress-${index + 1}`),
        category: String(item?.category || ""),
        weightPercent: Number(item?.weightPercent || 0),
        previousPercent: Number(item?.previousPercent || 0),
        weeklyPercent: Number(item?.weeklyPercent || 0),
        accumulatedPercent: Number(item?.accumulatedPercent || 0),
        remainingPercent: Number(item?.remainingPercent || 0),
        variancePercent: item?.variancePercent == null ? null : Number(item.variancePercent),
        plannedPercent: item?.plannedPercent == null ? null : Number(item.plannedPercent),
        amountTotal: item?.amountTotal == null ? null : Number(item.amountTotal),
        amountAccumulated:
          item?.amountAccumulated == null ? null : Number(item.amountAccumulated),
        amountRemaining: item?.amountRemaining == null ? null : Number(item.amountRemaining),
      })
    ),
    supervisors: toArray<WeeklySupervisor>(input.supervisors).map((item) => ({
      name: String(item?.name || ""),
      role: String(item?.role || ""),
    })),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export default function WeeklyReportPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [weeklyReports, setWeeklyReports] = useState<WeeklyListRow[]>([]);
  const [weeklyReportId, setWeeklyReportId] = useState("");
  const [detail, setDetail] = useState<WeeklyReportModel | null>(null);

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadingProjects(true);
      setError("");

      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        const list: ProjectRow[] = Array.isArray(json)
          ? json.map((item: any) => ({
              id: String(item?.id || ""),
              projectName: String(item?.projectName || "-"),
            }))
          : [];

        if (!cancelled) {
          setProjects(list);
          setProjectId((prev) => prev || list[0]?.id || "");
        }
      } catch {
        if (!cancelled) {
          setProjects([]);
          setError("โหลดรายการโครงการไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setWeeklyReports([]);
      setWeeklyReportId("");
      setDetail(null);
      setError("");

      if (!projectId) return;

      setLoadingReports(true);

      try {
        const res = await fetch(
          `/api/weekly-reports?projectId=${encodeURIComponent(projectId)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);

        const source = Array.isArray(json?.reports) ? json.reports : Array.isArray(json) ? json : [];

        const list: WeeklyListRow[] = source.map((item: any) => ({
          id: String(item?.id || ""),
          title: String(item?.title || `Weekly Report - Week ${Number(item?.weekNo || 0)}`),
          weekNo: Number(item?.weekNo || 0),
          year: Number(item?.year || 0),
          startDate: String(item?.startDate || ""),
          endDate: String(item?.endDate || ""),
        }));

        if (!cancelled) {
          setWeeklyReports(list);
          setWeeklyReportId(list[0]?.id || "");
        }
      } catch {
        if (!cancelled) {
          setWeeklyReports([]);
          setError("โหลดรายการ Weekly report ไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setDetail(null);
      setError("");

      if (!weeklyReportId) return;

      setLoadingDetail(true);

      try {
        const res = await fetch(`/api/weekly-reports/${encodeURIComponent(weeklyReportId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        const raw = json?.report ?? json;

        if (!res.ok) {
          throw new Error(json?.message || "โหลดรายละเอียด Weekly report ไม่สำเร็จ");
        }

        const normalized = normalizeWeeklyReport(raw as ApiWeeklyReport);

        if (!normalized) {
          throw new Error("ข้อมูล Weekly report ไม่สมบูรณ์");
        }

        if (!cancelled) {
          setDetail(normalized);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message || e || "เกิดข้อผิดพลาด"));
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [weeklyReportId]);

  const selectedLabel = useMemo(() => {
    const found = weeklyReports.find((item) => item.id === weeklyReportId);
    if (!found) return "-";
    return `${found.title} (${found.startDate} → ${found.endDate})`;
  }, [weeklyReports, weeklyReportId]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_30%),linear-gradient(180deg,rgba(248,250,252,1),rgba(241,245,249,1))] px-4 py-6 text-slate-900 dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_24%),linear-gradient(180deg,#020817,#081224)] dark:text-white md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500 dark:text-slate-400">
                Weekly report
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-4xl">
                ฟอร์มรายงานประจำสัปดาห์
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
                ใช้สำหรับแสดงผลข้อมูล Weekly ที่ถูกสรุปจาก n8n และบันทึกไว้ในฐานข้อมูล
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Selected report
              </div>
              <div className="mt-1 font-medium">{selectedLabel}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                โครงการ
              </div>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loadingProjects || projects.length === 0}
                className={cx(
                  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition",
                  "focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
                  "dark:border-white/10 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-500/20"
                )}
              >
                {projects.length === 0 ? (
                  <option value="">ไม่มีโครงการ</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.projectName}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                รายงานประจำสัปดาห์
              </div>
              <select
                value={weeklyReportId}
                onChange={(e) => setWeeklyReportId(e.target.value)}
                disabled={loadingReports || weeklyReports.length === 0}
                className={cx(
                  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition",
                  "focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
                  "dark:border-white/10 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-500/20"
                )}
              >
                {weeklyReports.length === 0 ? (
                  <option value="">ไม่มี Weekly report</option>
                ) : (
                  weeklyReports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.title} | Week {report.weekNo} | {report.startDate} - {report.endDate}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
        </section>

        <WeeklyReportForm
          model={detail}
          loading={loadingDetail}
          error={error}
        />
      </div>
    </main>
  );
}