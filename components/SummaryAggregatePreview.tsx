"use client";

import React from "react";
import {
  WeeklyReportForm,
  type WeeklyProgressItem,
  type WeeklyProblemItem,
  type WeeklyReportModel,
  type WeeklySupervisor,
  type WeeklyTimeSummary,
  type WeeklyWorkItem,
} from "@/components/WeeklyReportForm";

export type SummaryReportType = "DAILY" | "WEEKLY" | "MONTHLY";

export type SummaryDocumentModel = {
  reportType: SummaryReportType;
  documentTitle: string;
  projectName: string;
  periodLabel: string;
  selectedDate: string;
  title?: string | null;
  summary?: string | null;
  sourceReportIds?: string[];
  projectMeta?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

type AnyRecord = Record<string, unknown>;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function firstNonEmpty(...values: unknown[]): unknown {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return undefined;
}

function parsePeriodRangeFromLabel(periodLabel: string, fallbackDate: string) {
  const label = asString(periodLabel);
  if (!label) {
    return { startDate: fallbackDate || "", endDate: fallbackDate || "" };
  }

  const parts = label
    .split("ถึง")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { startDate: parts[0], endDate: parts[1] };
  }

  return { startDate: label, endDate: label };
}

function pickProjectMeta(payload: AnyRecord, projectMeta: AnyRecord) {
  const payloadMeta = toRecord(payload.projectMeta) || {};
  return {
    periodNo: asString(firstNonEmpty(payloadMeta.periodNo, projectMeta.periodNo), ""),
    contractNo: asString(firstNonEmpty(payloadMeta.contractNo, projectMeta.contractNo), ""),
    contractEnd: asString(firstNonEmpty(payloadMeta.contractEnd, projectMeta.contractEnd), ""),
    projectName: asString(firstNonEmpty(payloadMeta.projectName, projectMeta.projectName), ""),
    siteLocation: asString(firstNonEmpty(payloadMeta.siteLocation, projectMeta.siteLocation), ""),
    contractStart: asString(firstNonEmpty(payloadMeta.contractStart, projectMeta.contractStart), ""),
    contractValue: asString(firstNonEmpty(payloadMeta.contractValue, projectMeta.contractValue), ""),
    contractorName: asString(firstNonEmpty(payloadMeta.contractorName, projectMeta.contractorName), ""),
    procurementMethod: asString(
      firstNonEmpty(payloadMeta.procurementMethod, projectMeta.procurementMethod),
      ""
    ),
  };
}

function mapWorkItems(payload: AnyRecord): WeeklyWorkItem[] {
  const rows = toArray<AnyRecord>(payload.mergedWorkItems);

  return rows
    .map((row, index) => {
      const qtyRaw = firstNonEmpty(row.qtyTotal, row.qty, row.quantity, row.amount);
      const qtyParsed = qtyRaw == null || qtyRaw === "" ? null : asNumber(qtyRaw, Number.NaN);

      return {
        id: asString(firstNonEmpty(row.id, row.code), `work-${index + 1}`),
        description: asString(firstNonEmpty(row.desc, row.description, row.title, row.item), "-"),
        qty: Number.isFinite(qtyParsed as number) ? (qtyParsed as number) : null,
        unit: asString(row.unit, "") || null,
        location: asString(row.location, "") || null,
        remark: asString(firstNonEmpty(row.materialDelivered, row.remark, row.note), "") || null,
      };
    })
    .filter((item) => item.description !== "-" || item.qty != null || item.unit || item.location || item.remark);
}

function mapProblems(payload: AnyRecord): WeeklyProblemItem[] {
  const normalizedIssues = toArray<string>(payload.normalizedIssues);
  if (normalizedIssues.length > 0) {
    return normalizedIssues.map((topic, index) => ({
      id: `issue-${index + 1}`,
      topic: asString(topic, "-"),
      impact: null,
      solution: null,
    }));
  }

  const issueObjects = toArray<AnyRecord>(firstNonEmpty(payload.problemsAndObstacles, payload.issues));
  return issueObjects
    .map((row, index) => ({
      id: asString(firstNonEmpty(row.id, row.code), `issue-${index + 1}`),
      topic: asString(firstNonEmpty(row.topic, row.title, row.problem, row.detail), "-"),
      impact: asString(firstNonEmpty(row.impact, row.effect, row.result), "") || null,
      solution: asString(firstNonEmpty(row.solution, row.fix, row.resolution, row.action), "") || null,
    }))
    .filter((item) => item.topic !== "-" || item.impact || item.solution);
}

function mapProgress(payload: AnyRecord, reportType: SummaryReportType): WeeklyProgressItem[] {
  const rows = toArray<AnyRecord>(
    firstNonEmpty(payload.progressByCategory, payload.progressItems, payload.progressRows)
  );

  return rows.map((row, index) => {
    const currentPercent =
      reportType === "MONTHLY"
        ? firstNonEmpty(row.monthlyPercent, row.currentPercent, row.thisMonth, row.thisPeriod, row.weeklyPercent)
        : firstNonEmpty(row.weeklyPercent, row.currentPercent, row.thisWeek, row.thisPeriod, row.monthlyPercent);

    const plannedRaw = firstNonEmpty(row.plannedPercent, row.planPercent, row.plan, row.planned);
    const varianceRaw = firstNonEmpty(row.variancePercent, row.deviationPercent, row.deviation, row.variance);
    const amountTotalRaw = firstNonEmpty(row.amountTotal, row.totalAmount);
    const amountAccumulatedRaw = firstNonEmpty(row.amountAccumulated, row.accumulatedAmount);
    const amountRemainingRaw = firstNonEmpty(row.amountRemaining, row.remainingAmount);

    return {
      id: asString(firstNonEmpty(row.id, row.code), `progress-${index + 1}`),
      category: asString(firstNonEmpty(row.category, row.name, row.section, row.workType, row.title), `หมวดงาน ${index + 1}`),
      weightPercent: asNumber(firstNonEmpty(row.weightPercent, row.weight, row.weightPct, row.weightPercentage), 0),
      previousPercent: asNumber(firstNonEmpty(row.previousPercent, row.before, row.previous, row.beforePercent), 0),
      weeklyPercent: asNumber(currentPercent, 0),
      accumulatedPercent: asNumber(
        firstNonEmpty(row.accumulatedPercent, row.cumulativePercent, row.cumulative, row.accumulated),
        0
      ),
      remainingPercent: asNumber(firstNonEmpty(row.remainingPercent, row.remaining, row.balance), 0),
      plannedPercent:
        plannedRaw == null || plannedRaw === ""
          ? null
          : Number.isFinite(asNumber(plannedRaw, Number.NaN))
            ? asNumber(plannedRaw, 0)
            : null,
      variancePercent:
        varianceRaw == null || varianceRaw === ""
          ? null
          : Number.isFinite(asNumber(varianceRaw, Number.NaN))
            ? asNumber(varianceRaw, 0)
            : null,
      amountTotal:
        amountTotalRaw == null || amountTotalRaw === ""
          ? null
          : Number.isFinite(asNumber(amountTotalRaw, Number.NaN))
            ? asNumber(amountTotalRaw, 0)
            : null,
      amountAccumulated:
        amountAccumulatedRaw == null || amountAccumulatedRaw === ""
          ? null
          : Number.isFinite(asNumber(amountAccumulatedRaw, Number.NaN))
            ? asNumber(amountAccumulatedRaw, 0)
            : null,
      amountRemaining:
        amountRemainingRaw == null || amountRemainingRaw === ""
          ? null
          : Number.isFinite(asNumber(amountRemainingRaw, Number.NaN))
            ? asNumber(amountRemainingRaw, 0)
            : null,
    };
  });
}

function mapSupervisors(payload: AnyRecord): WeeklySupervisor[] {
  const rows = toArray<AnyRecord>(payload.supervisors);
  return rows
    .map((row) => ({
      name: asString(row.name, ""),
      role: asString(row.role, ""),
    }))
    .filter((row) => row.name || row.role);
}

function mapTimeSummary(payload: AnyRecord, reportType: SummaryReportType): WeeklyTimeSummary {
  const summary = toRecord(payload.timeSummary) || {};
  const currentRaw =
    reportType === "MONTHLY"
      ? firstNonEmpty(summary.currentMonthDays, summary.thisMonth, summary.thisPeriod, summary.current)
      : firstNonEmpty(summary.currentWeekDays, summary.thisWeek, summary.thisPeriod, summary.current);

  const plannedRaw = firstNonEmpty(summary.plannedDays, summary.planDays);
  const varianceRaw = firstNonEmpty(summary.varianceDays, summary.deviation, summary.variance, summary.delay);

  return {
    contractDays: asNumber(firstNonEmpty(summary.contractDays, summary.accordingToContract, summary.plan, summary.total), 0),
    previousUsedDays: asNumber(firstNonEmpty(summary.previousUsedDays, summary.beforeThisWeek, summary.before, summary.previous), 0),
    currentWeekDays: asNumber(currentRaw, 0),
    accumulatedDays: asNumber(firstNonEmpty(summary.accumulatedDays, summary.cumulative, summary.accumulated), 0),
    remainingDays: asNumber(firstNonEmpty(summary.remainingDays, summary.remaining, summary.balance), 0),
    plannedDays:
      plannedRaw == null || plannedRaw === ""
        ? null
        : Number.isFinite(asNumber(plannedRaw, Number.NaN))
          ? asNumber(plannedRaw, 0)
          : null,
    varianceDays:
      varianceRaw == null || varianceRaw === ""
        ? null
        : Number.isFinite(asNumber(varianceRaw, Number.NaN))
          ? asNumber(varianceRaw, 0)
          : null,
  };
}

function extractCommentText(model: SummaryDocumentModel, payload: AnyRecord): string {
  return asString(
    firstNonEmpty(
      payload.comments,
      payload.comment,
      payload.supervisorComment,
      payload.controllerComment,
      model.summary
    ),
    "-"
  );
}

function buildWeeklyModel(model: SummaryDocumentModel): WeeklyReportModel | null {
  if (model.reportType !== "WEEKLY" && model.reportType !== "MONTHLY") {
    return null;
  }

  const payload = toRecord(model.payload) || {};
  const projectMeta = toRecord(model.projectMeta) || {};
  const mergedMeta = pickProjectMeta(payload, projectMeta);
  const fallbackRange = parsePeriodRangeFromLabel(model.periodLabel, model.selectedDate);

  const startDate = asString(
    firstNonEmpty(payload.dateStart, payload.startDate, payload.weekStart, fallbackRange.startDate, model.selectedDate),
    model.selectedDate
  );

  const endDate = asString(
    firstNonEmpty(payload.dateEnd, payload.endDate, payload.weekEnd, fallbackRange.endDate, model.selectedDate),
    model.selectedDate
  );

  const weekNo = asNumber(firstNonEmpty(payload.weekNo, payload.week, payload.weekNumber), 0);
  const monthNo = asNumber(firstNonEmpty(payload.monthNo, payload.month), 0);
  const year = asNumber(firstNonEmpty(payload.year), new Date(model.selectedDate || Date.now()).getFullYear());

  const installmentLabel =
    mergedMeta.periodNo ||
    (model.reportType === "MONTHLY"
      ? monthNo > 0
        ? `เดือนที่ ${monthNo}`
        : "-"
      : weekNo > 0
        ? `สัปดาห์ที่ ${weekNo}`
        : "-");

  return {
    id: asString(firstNonEmpty(payload.id, payload.reportId), `${model.reportType}-${model.selectedDate || "preview"}`),
    projectId: asString(firstNonEmpty(payload.projectId), ""),
    year,
    weekNo,
    startDate,
    endDate,
    title: asString(firstNonEmpty(payload.title, model.title, model.documentTitle), model.documentTitle),
    summary: {
      projectName: asString(firstNonEmpty(mergedMeta.projectName, model.projectName), "-"),
      contractNo: asString(mergedMeta.contractNo, "-"),
      installmentLabel,
      contractorName: asString(mergedMeta.contractorName, "-"),
      siteLocation: asString(mergedMeta.siteLocation, "-"),
      contractStart: asString(mergedMeta.contractStart, "-"),
      contractEnd: asString(mergedMeta.contractEnd, "-"),
      contractValue: asString(mergedMeta.contractValue, "-"),
      procurementMethod: asString(mergedMeta.procurementMethod, "-"),
      periodNo: mergedMeta.periodNo || undefined,
    },
    timeSummary: mapTimeSummary(payload, model.reportType),
    workPerformedWeekly: mapWorkItems(payload),
    comments: extractCommentText(model, payload),
    problemsAndObstacles: mapProblems(payload),
    safety: {
      note: asString(firstNonEmpty(payload.safetyNote, payload.safetyRemark, payload.note, payload.remark, payload.remarks), "-"),
      accidentCount: (() => {
        const raw = firstNonEmpty(payload.accidentCount, payload.accident, payload.accidents);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      injuredCount: (() => {
        const raw = firstNonEmpty(payload.injuredCount, payload.injuryCount, payload.injury, payload.injuries);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      lostTimeCount: (() => {
        const raw = firstNonEmpty(payload.lostTimeCount, payload.lostTime, payload.losttime);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
    },
    progressByCategory: mapProgress(payload, model.reportType),
    supervisors: mapSupervisors(payload),
    createdAt: asString(firstNonEmpty(payload.createdAt), "") || undefined,
    updatedAt: asString(firstNonEmpty(payload.updatedAt), "") || undefined,
  };
}

function formatPrimitive(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  const text = String(value).trim();
  return text || "-";
}

function DebugCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">
        {typeof value === "object" ? JSON.stringify(value, null, 2) : formatPrimitive(value)}
      </pre>
    </div>
  );
}

export function SummaryAggregatePreview({
  model,
  printMode = false,
}: {
  model: SummaryDocumentModel;
  printMode?: boolean;
}) {
  const weeklyModel = React.useMemo(() => buildWeeklyModel(model), [model]);

  if ((model.reportType === "WEEKLY" || model.reportType === "MONTHLY") && weeklyModel) {
    const shouldShowDebug =
      weeklyModel.summary.contractNo === "-" &&
      weeklyModel.workPerformedWeekly.length === 0 &&
      weeklyModel.problemsAndObstacles.length === 0;

    return (
      <div className="w-full">
        <WeeklyReportForm model={weeklyModel} />

        {!printMode && shouldShowDebug ? (
          <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="text-sm font-semibold">Debug Weekly/Monthly payload from API</div>
            <div className="mt-1 text-xs opacity-80">
              ใช้ดูข้อมูลจริงที่ส่งมาจาก DB เพื่อเช็ก key สำหรับ map ลงฟอร์ม
            </div>

            <div className="mt-4 grid gap-3">
              <DebugCard label="model.summary (text)" value={model.summary || "-"} />
              <DebugCard label="projectMeta" value={model.projectMeta || {}} />
              <DebugCard label="payload" value={model.payload || {}} />
              <DebugCard label="adapted weeklyModel.summary" value={weeklyModel.summary} />
              <DebugCard label="adapted weeklyModel.timeSummary" value={weeklyModel.timeSummary} />
              <DebugCard label="adapted weeklyModel.workPerformedWeekly" value={weeklyModel.workPerformedWeekly} />
              <DebugCard label="adapted weeklyModel.problemsAndObstacles" value={weeklyModel.problemsAndObstacles} />
              <DebugCard label="adapted weeklyModel.progressByCategory" value={weeklyModel.progressByCategory} />
              <DebugCard label="adapted weeklyModel.supervisors" value={weeklyModel.supervisors} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[794px] rounded-[28px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-8",
        printMode &&
          "max-w-none rounded-none border-0 bg-white p-0 text-slate-900 shadow-none dark:border-0 dark:bg-white dark:text-slate-900"
      )}
    >
      <div className="text-sm text-slate-600 dark:text-slate-300">ไม่รองรับ preview ประเภทนี้</div>
    </div>
  );
}

export default SummaryAggregatePreview;