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

type AnyRecord = Record<string, unknown>;

export type SummaryDocumentModel = {
  reportType: SummaryReportType;
  documentTitle: string;
  projectName: string;
  periodLabel: string;
  selectedDate: string;
  title?: string | null;
  summary?: string | null;
  sourceReportIds?: string[];
  projectMeta?: AnyRecord | null;
  payload?: AnyRecord | null;
};

function toRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function toArray<T = AnyRecord>(value: unknown): T[] {
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

function pickProjectMetaFromPayload(model: SummaryDocumentModel): AnyRecord {
  const payload = toRecord(model.payload) || {};
  const payloadProjectMeta = toRecord(payload.projectMeta) || {};
  const modelProjectMeta = toRecord(model.projectMeta) || {};

  return Object.keys(payloadProjectMeta).length > 0 ? payloadProjectMeta : modelProjectMeta;
}

function mapWorkPerformedWeekly(payload: AnyRecord): WeeklyWorkItem[] {
  const rows = toArray<AnyRecord>(payload.mergedWorkItems);

  return rows.map((row, index) => ({
    id: asString(row.id, `work-${index + 1}`),
    description: asString(row.description, "-"),
    qty: row.qtyTotal == null || row.qtyTotal === "" ? null : asNumber(row.qtyTotal, 0),
    unit: asString(row.unit, "") || null,
    location: asString(row.location, "") || null,
    remark: asString(row.materialDelivered, "") || null,
  }));
}

function mapProblemsAndObstacles(payload: AnyRecord): WeeklyProblemItem[] {
  const rows = toArray<string>(payload.normalizedIssues);

  return rows.map((topic, index) => ({
    id: `issue-${index + 1}`,
    topic: asString(topic, "-"),
    impact: null,
    solution: null,
  }));
}

function mapTimeSummaryDirect(payload: AnyRecord): WeeklyTimeSummary {
  const timeSummary = toRecord(payload.timeSummary);

  if (!timeSummary) {
    return {
      contractDays: 0,
      previousUsedDays: 0,
      currentWeekDays: 0,
      accumulatedDays: 0,
      remainingDays: 0,
      plannedDays: null,
      varianceDays: null,
    };
  }

  return {
    contractDays: asNumber(timeSummary.contractDays, 0),
    previousUsedDays: asNumber(timeSummary.previousUsedDays, 0),
    currentWeekDays: asNumber(timeSummary.currentWeekDays, 0),
    accumulatedDays: asNumber(timeSummary.accumulatedDays, 0),
    remainingDays: asNumber(timeSummary.remainingDays, 0),
    plannedDays:
      timeSummary.plannedDays == null || timeSummary.plannedDays === ""
        ? null
        : asNumber(timeSummary.plannedDays, 0),
    varianceDays:
      timeSummary.varianceDays == null || timeSummary.varianceDays === ""
        ? null
        : asNumber(timeSummary.varianceDays, 0),
  };
}

function mapProgressByCategoryDirect(payload: AnyRecord): WeeklyProgressItem[] {
  const rows = toArray<AnyRecord>(payload.progressByCategory);

  return rows.map((row, index) => ({
    id: asString(row.id, `progress-${index + 1}`),
    category: asString(row.category, `หมวดงาน ${index + 1}`),
    weightPercent: asNumber(row.weightPercent, 0),
    previousPercent: asNumber(row.previousPercent, 0),
    weeklyPercent: asNumber(row.weeklyPercent, 0),
    accumulatedPercent: asNumber(row.accumulatedPercent, 0),
    remainingPercent: asNumber(row.remainingPercent, 0),
    plannedPercent:
      row.plannedPercent == null || row.plannedPercent === ""
        ? null
        : asNumber(row.plannedPercent, 0),
    variancePercent:
      row.variancePercent == null || row.variancePercent === ""
        ? null
        : asNumber(row.variancePercent, 0),
    amountTotal:
      row.amountTotal == null || row.amountTotal === ""
        ? null
        : asNumber(row.amountTotal, 0),
    amountAccumulated:
      row.amountAccumulated == null || row.amountAccumulated === ""
        ? null
        : asNumber(row.amountAccumulated, 0),
    amountRemaining:
      row.amountRemaining == null || row.amountRemaining === ""
        ? null
        : asNumber(row.amountRemaining, 0),
  }));
}

function mapSupervisorsDirect(payload: AnyRecord): WeeklySupervisor[] {
  const rows = toArray<AnyRecord>(payload.supervisors);

  return rows
    .map((row) => ({
      name: asString(row.name, ""),
      role: asString(row.role, ""),
    }))
    .filter((row) => row.name || row.role);
}

function buildWeeklyModel(model: SummaryDocumentModel): WeeklyReportModel | null {
  if (model.reportType !== "WEEKLY" && model.reportType !== "MONTHLY") {
    return null;
  }

  const payload = toRecord(model.payload) || {};
  const projectMeta = pickProjectMetaFromPayload(model);

  const weekNo = asNumber(payload.weekNo, 0);
  const startDate = asString(payload.dateStart, model.selectedDate || "");
  const endDate = asString(payload.dateEnd, model.selectedDate || "");

  const summary = {
    projectName: asString(projectMeta.projectName, "-"),
    contractNo: asString(projectMeta.contractNo, "-"),
    installmentLabel: asString(projectMeta.periodNo, "-"),
    contractorName: asString(projectMeta.contractorName, "-"),
    siteLocation: asString(projectMeta.siteLocation, "-"),
    contractStart: asString(projectMeta.contractStart, "-"),
    contractEnd: asString(projectMeta.contractEnd, "-"),
    contractValue: asString(projectMeta.contractValue, "-"),
    procurementMethod: asString(projectMeta.procurementMethod, "-"),
    periodNo: asString(projectMeta.periodNo, "") || undefined,
  };

  // DIRECT WEEKLY PREVIEW BUILD
  const weeklyModel: WeeklyReportModel = {
    id: asString(payload.id, `${model.reportType}-${model.selectedDate || "preview"}`),
    projectId: asString(payload.projectId, ""),
    year: asNumber(payload.year, new Date().getFullYear()),
    weekNo,
    startDate,
    endDate,
    title: asString(model.title || model.documentTitle, model.documentTitle),
    summary,
    timeSummary: mapTimeSummaryDirect(payload),
    workPerformedWeekly: mapWorkPerformedWeekly(payload),
    comments: asString(model.summary, "-"),
    problemsAndObstacles: mapProblemsAndObstacles(payload),
    safety: {
      note: "-",
      accidentCount: 0,
      injuredCount: 0,
      lostTimeCount: 0,
    },
    progressByCategory: mapProgressByCategoryDirect(payload),
    supervisors: mapSupervisorsDirect(payload),
    createdAt: asString(payload.createdAt, "") || undefined,
    updatedAt: asString(payload.updatedAt, "") || undefined,
  };

  return weeklyModel;
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
    return <WeeklyReportForm model={weeklyModel} loading={false} error={undefined} />;
  }

  return (
    <div
      className={[
        "rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-500",
        printMode ? "shadow-none" : "shadow-sm",
      ].join(" ")}
    >
      ไม่รองรับ preview ประเภทนี้
    </div>
  );
}

export default SummaryAggregatePreview;