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
  projectMeta?: AnyRecord | string | null;
  payload?: AnyRecord | string | null;
};

function toRecord(value: unknown): AnyRecord | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as AnyRecord;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof value !== "object" || Array.isArray(value)) return null;
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
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return fallback;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function pickPayload(model: SummaryDocumentModel): AnyRecord {
  return toRecord(model.payload) || {};
}

function pickProjectMeta(model: SummaryDocumentModel, payload: AnyRecord): AnyRecord {
  const payloadProjectMeta = toRecord(payload.projectMeta) || {};
  const rootProjectMeta = toRecord(model.projectMeta) || {};

  if (Object.keys(payloadProjectMeta).length > 0) return payloadProjectMeta;
  return rootProjectMeta;
}

function parsePeriodRangeFromLabel(periodLabel: string, fallbackDate: string) {
  const label = asString(periodLabel);
  if (!label) {
    return {
      startDate: fallbackDate || "",
      endDate: fallbackDate || "",
    };
  }

  const parts = label
    .split("ถึง")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      startDate: parts[0],
      endDate: parts[1],
    };
  }

  return {
    startDate: label,
    endDate: label,
  };
}

function mapWorkPerformedWeekly(payload: AnyRecord): WeeklyWorkItem[] {
  const rows = toArray<AnyRecord>(payload.mergedWorkItems);

  return rows.map((row, index) => ({
    id: asString(row.id, `work-${index + 1}`),
    description: asString(row.description, "-"),
    qty:
      row.qtyTotal == null || String(row.qtyTotal).trim() === ""
        ? null
        : asNumber(row.qtyTotal, 0),
    unit: asString(row.unit, "") || null,
    location: asString(row.location, "") || null,
    remark: asString(row.materialDelivered, "") || null,
  }));
}

function mapProblemsAndObstacles(payload: AnyRecord): WeeklyProblemItem[] {
  const rows = toArray(payload.normalizedIssues);

  return rows.map((item, index) => ({
    id: `issue-${index + 1}`,
    topic: asString(item, "-"),
    impact: null,
    solution: null,
  }));
}

function mapTimeSummary(payload: AnyRecord): WeeklyTimeSummary {
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
      timeSummary.plannedDays == null || String(timeSummary.plannedDays).trim() === ""
        ? null
        : asNumber(timeSummary.plannedDays, 0),
    varianceDays:
      timeSummary.varianceDays == null || String(timeSummary.varianceDays).trim() === ""
        ? null
        : asNumber(timeSummary.varianceDays, 0),
  };
}

function mapProgressByCategory(payload: AnyRecord): WeeklyProgressItem[] {
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
      row.plannedPercent == null || String(row.plannedPercent).trim() === ""
        ? null
        : asNumber(row.plannedPercent, 0),
    variancePercent:
      row.variancePercent == null || String(row.variancePercent).trim() === ""
        ? null
        : asNumber(row.variancePercent, 0),
    amountTotal:
      row.amountTotal == null || String(row.amountTotal).trim() === ""
        ? null
        : asNumber(row.amountTotal, 0),
    amountAccumulated:
      row.amountAccumulated == null || String(row.amountAccumulated).trim() === ""
        ? null
        : asNumber(row.amountAccumulated, 0),
    amountRemaining:
      row.amountRemaining == null || String(row.amountRemaining).trim() === ""
        ? null
        : asNumber(row.amountRemaining, 0),
  }));
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

function buildWeeklyModel(model: SummaryDocumentModel): WeeklyReportModel | null {
  if (model.reportType !== "WEEKLY" && model.reportType !== "MONTHLY") {
    return null;
  }

  const payload = pickPayload(model);
  const projectMeta = pickProjectMeta(model, payload);
  const fallbackRange = parsePeriodRangeFromLabel(model.periodLabel, model.selectedDate);

  const weekNo = asNumber(payload.weekNo, 0);
  const startDate = asString(payload.dateStart, fallbackRange.startDate || model.selectedDate || "");
  const endDate = asString(payload.dateEnd, fallbackRange.endDate || model.selectedDate || "");

  // DIRECT WEEKLY PREVIEW BUILD
  const weeklyModel: WeeklyReportModel = {
    id: asString(payload.id, `${model.reportType}-${model.selectedDate || "preview"}`),
    projectId: asString(payload.projectId, ""),
    year: asNumber(
      payload.year,
      new Date(model.selectedDate || Date.now()).getFullYear()
    ),
    weekNo,
    startDate,
    endDate,
    title: asString(model.title || model.documentTitle, model.documentTitle),
    summary: {
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
    },
    timeSummary: mapTimeSummary(payload),
    workPerformedWeekly: mapWorkPerformedWeekly(payload),
    comments: asString(model.summary, "-"),
    problemsAndObstacles: mapProblemsAndObstacles(payload),
    safety: {
      note: "-",
      accidentCount: 0,
      injuredCount: 0,
      lostTimeCount: 0,
    },
    progressByCategory: mapProgressByCategory(payload),
    supervisors: mapSupervisors(payload),
    createdAt: asString(payload.createdAt, "") || undefined,
    updatedAt: asString(payload.updatedAt, "") || undefined,
  };

  return weeklyModel;
}

export function SummaryAggregatePreview({
  model,
}: {
  model: SummaryDocumentModel;
  printMode?: boolean;
}) {
  const weeklyModel = React.useMemo(() => buildWeeklyModel(model), [model]);

  if ((model.reportType === "WEEKLY" || model.reportType === "MONTHLY") && weeklyModel) {
    return <WeeklyReportForm model={weeklyModel} loading={false} error={undefined} />;
  }

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-500 shadow-sm">
      ไม่รองรับ preview ประเภทนี้
    </div>
  );
}

export default SummaryAggregatePreview;