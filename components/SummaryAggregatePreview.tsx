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

function asString(value: unknown, fallback = "") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return undefined;
}

function uniqueLower(values: string[]) {
  return [...new Set(values.map((v) => v.toLowerCase()))];
}

function findValueDeep(
  input: unknown,
  aliases: string[],
  maxDepth = 8,
  seen = new WeakSet<object>()
): unknown {
  const normalizedAliases = uniqueLower(aliases);

  function walk(value: unknown, depth: number): unknown {
    if (depth > maxDepth || value == null) return undefined;

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    if (typeof value !== "object") return undefined;

    const record = value as AnyRecord;
    if (seen.has(record)) return undefined;
    seen.add(record);

    for (const [key, val] of Object.entries(record)) {
      if (normalizedAliases.includes(key.toLowerCase())) {
        if (val !== undefined && val !== null && !(typeof val === "string" && val.trim() === "")) {
          return val;
        }
      }
    }

    for (const child of Object.values(record)) {
      const found = walk(child, depth + 1);
      if (found !== undefined) return found;
    }

    return undefined;
  }

  return walk(input, 0);
}

function findArrayDeep(input: unknown, aliases: string[], maxDepth = 8): AnyRecord[] {
  const found = findValueDeep(input, aliases, maxDepth);
  return Array.isArray(found) ? (found as AnyRecord[]) : [];
}

function parsePeriodRangeFromLabel(periodLabel: string, fallbackDate: string) {
  const label = asString(periodLabel);
  if (!label) {
    return { startDate: fallbackDate || "", endDate: fallbackDate || "" };
  }

  const parts = label.split("ถึง").map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { startDate: parts[0], endDate: parts[1] };
  }

  return { startDate: label, endDate: label };
}

function makeWeeklyWorkItems(root: unknown): WeeklyWorkItem[] {
  const rows = findArrayDeep(root, [
    "workPerformedWeekly",
    "workPerformedMonthly",
    "mergedWorkItems",
    "workItems",
    "works",
    "items",
  ]);

  return rows
    .map((row, index) => {
      const description = asString(
        firstNonEmpty(
          findValueDeep(row, ["description", "desc", "workName", "item", "title", "name"])
        ),
        "-"
      );

      const qtyRaw = firstNonEmpty(findValueDeep(row, ["qty", "quantity", "amount"]));
      const qtyParsed = qtyRaw == null || qtyRaw === "" ? null : asNumber(qtyRaw, Number.NaN);

      const unit = asString(findValueDeep(row, ["unit"]), "");
      const location = asString(findValueDeep(row, ["location", "position", "area"]), "");
      const remark = asString(findValueDeep(row, ["remark", "remarks", "note", "materialDelivered"]), "");

      return {
        id: asString(firstNonEmpty(row.id, row.code), `work-${index + 1}`),
        description,
        qty: Number.isFinite(qtyParsed as number) ? (qtyParsed as number) : null,
        unit: unit || null,
        location: location || null,
        remark: remark || null,
      };
    })
    .filter((row) => row.description !== "-" || row.qty != null || row.unit || row.location || row.remark);
}

function makeWeeklyProblems(root: unknown): WeeklyProblemItem[] {
  const rows = findArrayDeep(root, [
    "problemsAndObstacles",
    "issues",
    "issueSummary",
    "obstacles",
    "problems",
  ]);

  return rows
    .map((row, index) => {
      const topic = asString(
        firstNonEmpty(findValueDeep(row, ["topic", "title", "problem", "detail"])),
        "-"
      );
      const impact = asString(findValueDeep(row, ["impact", "effect", "result"]), "");
      const solution = asString(findValueDeep(row, ["solution", "fix", "resolution", "action"]), "");

      return {
        id: asString(firstNonEmpty(row.id, row.code), `problem-${index + 1}`),
        topic,
        impact: impact || null,
        solution: solution || null,
      };
    })
    .filter((row) => row.topic !== "-" || row.impact || row.solution);
}

function makeWeeklyProgress(root: unknown, reportType: SummaryReportType): WeeklyProgressItem[] {
  let rows = findArrayDeep(root, ["progressByCategory", "progressItems", "progressRows"]);
  if (!rows.length) {
    rows = findArrayDeep(root, ["items", "rows"]);
  }

  return rows
    .map((row, index) => {
      const currentRaw =
        reportType === "MONTHLY"
          ? firstNonEmpty(
              findValueDeep(row, ["monthlyPercent", "currentPercent", "thisMonth", "thisPeriod"]),
              findValueDeep(row, ["weeklyPercent", "thisWeek"])
            )
          : firstNonEmpty(
              findValueDeep(row, ["weeklyPercent", "currentPercent", "thisWeek", "thisPeriod"]),
              findValueDeep(row, ["monthlyPercent", "thisMonth"])
            );

      const plannedRaw = firstNonEmpty(findValueDeep(row, ["plannedPercent", "planPercent", "plan", "planned"]));
      const varianceRaw = firstNonEmpty(
        findValueDeep(row, ["variancePercent", "deviationPercent", "deviation", "variance", "delay"])
      );
      const amountTotalRaw = firstNonEmpty(findValueDeep(row, ["amountTotal", "totalAmount"]));
      const amountAccumRaw = firstNonEmpty(findValueDeep(row, ["amountAccumulated", "accumulatedAmount"]));
      const amountRemainRaw = firstNonEmpty(findValueDeep(row, ["amountRemaining", "remainingAmount"]));

      return {
        id: asString(firstNonEmpty(row.id, row.code), `progress-${index + 1}`),
        category: asString(
          firstNonEmpty(findValueDeep(row, ["category", "name", "section", "workType", "title"])),
          `หมวดงาน ${index + 1}`
        ),
        weightPercent: asNumber(findValueDeep(row, ["weightPercent", "weight", "weightPct", "weightPercentage"]), 0),
        previousPercent: asNumber(findValueDeep(row, ["previousPercent", "before", "previous", "beforePercent"]), 0),
        weeklyPercent: asNumber(currentRaw, 0),
        accumulatedPercent: asNumber(
          findValueDeep(row, ["accumulatedPercent", "cumulativePercent", "cumulative", "accumulated"]),
          0
        ),
        remainingPercent: asNumber(findValueDeep(row, ["remainingPercent", "remaining", "balance"]), 0),
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
          amountAccumRaw == null || amountAccumRaw === ""
            ? null
            : Number.isFinite(asNumber(amountAccumRaw, Number.NaN))
            ? asNumber(amountAccumRaw, 0)
            : null,
        amountRemaining:
          amountRemainRaw == null || amountRemainRaw === ""
            ? null
            : Number.isFinite(asNumber(amountRemainRaw, Number.NaN))
            ? asNumber(amountRemainRaw, 0)
            : null,
      };
    })
    .filter((row) => row.category || row.weightPercent || row.previousPercent || row.weeklyPercent || row.accumulatedPercent);
}

function makeWeeklySupervisors(root: unknown): WeeklySupervisor[] {
  const rows = findArrayDeep(root, ["supervisors", "approvedBy", "signers"]);

  return rows
    .map((row) => ({
      name: asString(findValueDeep(row, ["name"]), ""),
      role: asString(findValueDeep(row, ["role"]), ""),
    }))
    .filter((row) => row.name || row.role);
}

function makeWeeklyTimeSummary(root: unknown, reportType: SummaryReportType): WeeklyTimeSummary {
  const currentRaw =
    reportType === "MONTHLY"
      ? firstNonEmpty(
          findValueDeep(root, ["currentMonthDays", "thisMonth", "thisPeriod", "current"]),
          findValueDeep(root, ["currentWeekDays", "thisWeek"])
        )
      : firstNonEmpty(
          findValueDeep(root, ["currentWeekDays", "thisWeek", "thisPeriod", "current"]),
          findValueDeep(root, ["currentMonthDays", "thisMonth"])
        );

  const plannedRaw = firstNonEmpty(findValueDeep(root, ["plannedDays", "planDays"]));
  const varianceRaw = firstNonEmpty(findValueDeep(root, ["varianceDays", "deviation", "variance", "delay"]));

  return {
    contractDays: asNumber(findValueDeep(root, ["contractDays", "accordingToContract", "plan", "total"]), 0),
    previousUsedDays: asNumber(findValueDeep(root, ["previousUsedDays", "beforeThisWeek", "before", "previous"]), 0),
    currentWeekDays: asNumber(currentRaw, 0),
    accumulatedDays: asNumber(findValueDeep(root, ["accumulatedDays", "cumulative", "accumulated"]), 0),
    remainingDays: asNumber(findValueDeep(root, ["remainingDays", "remaining", "balance"]), 0),
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

function buildInstallmentLabel(root: unknown, reportType: SummaryReportType) {
  const explicit = asString(
    firstNonEmpty(
      findValueDeep(root, ["installmentLabel"]),
      findValueDeep(root, ["periodNo"])
    ),
    ""
  );

  if (explicit) return explicit;

  if (reportType === "MONTHLY") {
    const monthNo = asNumber(findValueDeep(root, ["monthNo", "month"]), 0);
    return monthNo > 0 ? `เดือนที่ ${monthNo}` : "-";
  }

  const weekNo = asNumber(findValueDeep(root, ["weekNo", "week", "weekNumber"]), 0);
  return weekNo > 0 ? `สัปดาห์ที่ ${weekNo}` : "-";
}

function adaptSummaryToWeeklyModel(model: SummaryDocumentModel): WeeklyReportModel | null {
  const payload = toRecord(model.payload) || {};
  const meta = toRecord(model.projectMeta) || {};
  const root = { payload, meta };

  const fallbackRange = parsePeriodRangeFromLabel(model.periodLabel, model.selectedDate);

  const startDate = asString(
    firstNonEmpty(
      findValueDeep(root, ["startDate", "weekStart", "periodStart", "fromDate"]),
      fallbackRange.startDate,
      model.selectedDate
    ),
    model.selectedDate
  );

  const endDate = asString(
    firstNonEmpty(
      findValueDeep(root, ["endDate", "weekEnd", "periodEnd", "toDate"]),
      fallbackRange.endDate,
      model.selectedDate
    ),
    model.selectedDate
  );

  const weekNo = asNumber(findValueDeep(root, ["weekNo", "week", "weekNumber"]), 0);
  const year = asNumber(findValueDeep(root, ["year"]), new Date().getFullYear());

  return {
    id: asString(
      firstNonEmpty(
        findValueDeep(root, ["id", "reportId"]),
        `${model.reportType}-${model.selectedDate || "preview"}`
      )
    ),
    projectId: asString(firstNonEmpty(findValueDeep(root, ["projectId"])), ""),
    year,
    weekNo,
    startDate,
    endDate,
    title: asString(firstNonEmpty(findValueDeep(root, ["title"]), model.title, model.documentTitle), model.documentTitle),
    summary: {
      projectName: asString(
        firstNonEmpty(
          findValueDeep(root, ["projectName"]),
          model.projectName
        ),
        "-"
      ),
      contractNo: asString(firstNonEmpty(findValueDeep(root, ["contractNo", "contractNumber"])), "-"),
      installmentLabel: buildInstallmentLabel(root, model.reportType),
      contractorName: asString(firstNonEmpty(findValueDeep(root, ["contractorName", "contractor"])), "-"),
      siteLocation: asString(firstNonEmpty(findValueDeep(root, ["siteLocation", "location"])), "-"),
      contractStart: asString(firstNonEmpty(findValueDeep(root, ["contractStart", "contractStartDate"])), "-"),
      contractEnd: asString(firstNonEmpty(findValueDeep(root, ["contractEnd", "contractEndDate"])), "-"),
      contractValue: asString(firstNonEmpty(findValueDeep(root, ["contractValue", "budget", "projectValue"])), "-"),
      procurementMethod: asString(firstNonEmpty(findValueDeep(root, ["procurementMethod", "purchaseMethod"])), "-"),
      periodNo: asString(firstNonEmpty(findValueDeep(root, ["periodNo"])), "") || undefined,
    },
    timeSummary: makeWeeklyTimeSummary(root, model.reportType),
    workPerformedWeekly: makeWeeklyWorkItems(root),
    comments: asString(
      firstNonEmpty(
        findValueDeep(root, ["comments", "comment", "supervisorComment", "controllerComment"]),
        model.summary
      ),
      "-"
    ),
    problemsAndObstacles: makeWeeklyProblems(root),
    safety: {
      note: asString(firstNonEmpty(findValueDeep(root, ["safetyNote", "safetyRemark", "note", "remark", "remarks"])), "-"),
      accidentCount: (() => {
        const raw = firstNonEmpty(findValueDeep(root, ["accidentCount", "accident", "accidents"]));
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      injuredCount: (() => {
        const raw = firstNonEmpty(findValueDeep(root, ["injuredCount", "injuryCount", "injury", "injuries"]));
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      lostTimeCount: (() => {
        const raw = firstNonEmpty(findValueDeep(root, ["lostTimeCount", "lostTime", "losttime"]));
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
    },
    progressByCategory: makeWeeklyProgress(root, model.reportType),
    supervisors: makeWeeklySupervisors(root),
    createdAt: asString(firstNonEmpty(findValueDeep(root, ["createdAt"])), "") || undefined,
    updatedAt: asString(firstNonEmpty(findValueDeep(root, ["updatedAt"])), "") || undefined,
  };
}

function formatPrimitive(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  const text = String(value).trim();
  return text || "-";
}

function DebugCard({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
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
  const weeklyModel = React.useMemo(() => adaptSummaryToWeeklyModel(model), [model]);

  const hasStructuredData = React.useMemo(() => {
    if (!weeklyModel) return false;
    return Boolean(
      weeklyModel.summary.projectName !== "-" ||
        weeklyModel.summary.contractNo !== "-" ||
        weeklyModel.summary.contractorName !== "-" ||
        weeklyModel.summary.siteLocation !== "-" ||
        weeklyModel.workPerformedWeekly.length ||
        weeklyModel.problemsAndObstacles.length ||
        weeklyModel.progressByCategory.length ||
        weeklyModel.supervisors.length ||
        weeklyModel.comments !== "-"
    );
  }, [weeklyModel]);

  if ((model.reportType === "WEEKLY" || model.reportType === "MONTHLY") && weeklyModel) {
    return (
      <div className="w-full">
        <WeeklyReportForm model={weeklyModel} />
        {!printMode && !hasStructuredData ? (
          <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="text-sm font-semibold">ยัง map field จาก DB ไม่ได้เพียงพอ</div>
            <div className="mt-1 text-xs opacity-80">
              ด้านล่างคือข้อมูลดิบจาก API เพื่อเช็ก key จริงของ payload/projectMeta
            </div>
            <div className="mt-4 grid gap-3">
              <DebugCard label="projectMeta" value={model.projectMeta || {}} />
              <DebugCard label="payload" value={model.payload || {}} />
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
      <div className="text-sm text-slate-600 dark:text-slate-300">
        ไม่รองรับ preview ประเภทนี้
      </div>
    </div>
  );
}

export default SummaryAggregatePreview;