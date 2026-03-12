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

function firstDefined<T>(...values: unknown[]): T | undefined {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value as T;
  }
  return undefined;
}

function getByAliases(record: AnyRecord | null | undefined, aliases: string[]) {
  if (!record) return undefined;

  for (const alias of aliases) {
    if (alias in record) return record[alias];
  }

  const lowerEntries = Object.entries(record).map(([k, v]) => [k.toLowerCase(), v] as const);
  for (const alias of aliases) {
    const found = lowerEntries.find(([k]) => k === alias.toLowerCase());
    if (found) return found[1];
  }

  return undefined;
}

function parsePeriodRange(periodLabel: string, fallbackDate: string) {
  const label = asString(periodLabel);
  if (!label) {
    return {
      startDate: fallbackDate || "",
      endDate: fallbackDate || "",
    };
  }

  const parts = label.split("ถึง").map((item) => item.trim()).filter(Boolean);
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

function makeWeeklyWorkItems(payload: AnyRecord): WeeklyWorkItem[] {
  const rows = toArray<AnyRecord>(
    firstDefined(
      getByAliases(payload, ["workPerformedWeekly", "workPerformedMonthly", "mergedWorkItems", "workItems", "works"])
    )
  );

  return rows.map((row, index) => ({
    id: asString(firstDefined(row.id, row.code), `work-${index + 1}`),
    description: asString(
      firstDefined(
        getByAliases(row, ["description", "desc", "workName", "item", "title", "name"])
      ),
      "-"
    ),
    qty: (() => {
      const raw = firstDefined(getByAliases(row, ["qty", "quantity", "amount"]));
      if (raw == null || raw === "") return null;
      const parsed = asNumber(raw, Number.NaN);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    unit: (() => {
      const value = asString(getByAliases(row, ["unit"]), "");
      return value || null;
    })(),
    location: (() => {
      const value = asString(getByAliases(row, ["location", "position", "area"]), "");
      return value || null;
    })(),
    remark: (() => {
      const value = asString(
        getByAliases(row, ["remark", "remarks", "note", "materialDelivered"]),
        ""
      );
      return value || null;
    })(),
  }));
}

function makeWeeklyProblems(payload: AnyRecord): WeeklyProblemItem[] {
  const rows = toArray<AnyRecord>(
    firstDefined(
      getByAliases(payload, ["problemsAndObstacles", "issues", "issueSummary", "obstacles"])
    )
  );

  return rows.map((row, index) => ({
    id: asString(firstDefined(row.id, row.code), `problem-${index + 1}`),
    topic: asString(
      firstDefined(getByAliases(row, ["topic", "title", "problem", "detail"])),
      "-"
    ),
    impact: (() => {
      const value = asString(getByAliases(row, ["impact", "effect", "result"]), "");
      return value || null;
    })(),
    solution: (() => {
      const value = asString(getByAliases(row, ["solution", "fix", "resolution", "action"]), "");
      return value || null;
    })(),
  }));
}

function makeWeeklyProgress(payload: AnyRecord, reportType: SummaryReportType): WeeklyProgressItem[] {
  const rows = toArray<AnyRecord>(
    firstDefined(
      getByAliases(payload, ["progressByCategory", "progressItems", "progressRows", "progress"]),
      getByAliases(toRecord(getByAliases(payload, ["progressSummary", "progressTable"])), ["items", "rows"])
    )
  );

  return rows.map((row, index) => {
    const currentPercent =
      reportType === "MONTHLY"
        ? firstDefined(
            getByAliases(row, ["monthlyPercent", "currentPercent", "thisMonth", "thisPeriod"]),
            getByAliases(row, ["weeklyPercent", "thisWeek"])
          )
        : firstDefined(
            getByAliases(row, ["weeklyPercent", "currentPercent", "thisWeek", "thisPeriod"]),
            getByAliases(row, ["monthlyPercent", "thisMonth"])
          );

    return {
      id: asString(firstDefined(row.id, row.code), `progress-${index + 1}`),
      category: asString(
        firstDefined(getByAliases(row, ["category", "name", "section", "workType", "title"])),
        `หมวดงาน ${index + 1}`
      ),
      weightPercent: asNumber(
        getByAliases(row, ["weightPercent", "weight", "weightPct", "weightPercentage"]),
        0
      ),
      previousPercent: asNumber(
        getByAliases(row, ["previousPercent", "before", "previous", "beforePercent"]),
        0
      ),
      weeklyPercent: asNumber(currentPercent, 0),
      accumulatedPercent: asNumber(
        getByAliases(row, ["accumulatedPercent", "cumulativePercent", "cumulative", "accumulated"]),
        0
      ),
      remainingPercent: asNumber(
        getByAliases(row, ["remainingPercent", "remaining", "balance"]),
        0
      ),
      plannedPercent: (() => {
        const raw = getByAliases(row, ["plannedPercent", "planPercent", "plan", "planned"]);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      variancePercent: (() => {
        const raw = getByAliases(row, ["variancePercent", "deviationPercent", "deviation", "variance", "delay"]);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      amountTotal: (() => {
        const raw = getByAliases(row, ["amountTotal", "totalAmount"]);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      amountAccumulated: (() => {
        const raw = getByAliases(row, ["amountAccumulated", "accumulatedAmount"]);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      amountRemaining: (() => {
        const raw = getByAliases(row, ["amountRemaining", "remainingAmount"]);
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
    };
  });
}

function makeWeeklySupervisors(payload: AnyRecord, meta: AnyRecord): WeeklySupervisor[] {
  const rows = toArray<AnyRecord>(
    firstDefined(
      getByAliases(payload, ["supervisors", "approvedBy", "signers"]),
      getByAliases(meta, ["supervisors", "approvedBy", "signers"])
    )
  );

  return rows
    .map((row) => ({
      name: asString(row.name, ""),
      role: asString(row.role, ""),
    }))
    .filter((row) => row.name || row.role);
}

function makeWeeklyTimeSummary(payload: AnyRecord, reportType: SummaryReportType): WeeklyTimeSummary {
  const timeSummary =
    toRecord(
      firstDefined(
        getByAliases(payload, ["timeSummary", "durationSummary", "scheduleSummary"]),
        getByAliases(payload, ["summary"])
      )
    ) || {};

  const currentKeyValue =
    reportType === "MONTHLY"
      ? firstDefined(
          getByAliases(timeSummary, ["currentMonthDays", "thisMonth", "thisPeriod", "current"]),
          getByAliases(timeSummary, ["currentWeekDays", "thisWeek"])
        )
      : firstDefined(
          getByAliases(timeSummary, ["currentWeekDays", "thisWeek", "thisPeriod", "current"]),
          getByAliases(timeSummary, ["currentMonthDays", "thisMonth"])
        );

  return {
    contractDays: asNumber(
      firstDefined(
        getByAliases(timeSummary, ["contractDays", "accordingToContract", "plan", "total"])
      ),
      0
    ),
    previousUsedDays: asNumber(
      firstDefined(
        getByAliases(timeSummary, ["previousUsedDays", "beforeThisWeek", "before", "previous"])
      ),
      0
    ),
    currentWeekDays: asNumber(currentKeyValue, 0),
    accumulatedDays: asNumber(
      firstDefined(getByAliases(timeSummary, ["accumulatedDays", "cumulative", "accumulated"])),
      0
    ),
    remainingDays: asNumber(
      firstDefined(getByAliases(timeSummary, ["remainingDays", "remaining", "balance"])),
      0
    ),
    plannedDays: (() => {
      const raw = firstDefined(getByAliases(timeSummary, ["plannedDays", "planDays"]));
      if (raw == null || raw === "") return null;
      const parsed = asNumber(raw, Number.NaN);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    varianceDays: (() => {
      const raw = firstDefined(
        getByAliases(timeSummary, ["varianceDays", "deviation", "variance", "delay"])
      );
      if (raw == null || raw === "") return null;
      const parsed = asNumber(raw, Number.NaN);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  };
}

function adaptSummaryToWeeklyModel(model: SummaryDocumentModel): WeeklyReportModel | null {
  const payload = toRecord(model.payload) || {};
  const meta = toRecord(model.projectMeta) || {};
  const summary =
    toRecord(
      firstDefined(
        getByAliases(payload, ["summary", "projectSummary", "weeklySummary", "monthlySummary"]),
        payload
      )
    ) || {};

  const existingStructured =
    getByAliases(payload, ["summary"]) &&
    getByAliases(payload, ["timeSummary"]) &&
    (getByAliases(payload, ["workPerformedWeekly"]) || getByAliases(payload, ["workPerformedMonthly"]));

  const parsedRange = parsePeriodRange(model.periodLabel, model.selectedDate);

  const weekNo = asNumber(
    firstDefined(
      getByAliases(payload, ["weekNo", "week", "weekNumber"]),
      getByAliases(summary, ["weekNo", "week", "weekNumber"])
    ),
    0
  );

  const year = asNumber(
    firstDefined(
      getByAliases(payload, ["year"]),
      getByAliases(summary, ["year"])
    ),
    new Date().getFullYear()
  );

  const structuredModel: WeeklyReportModel = {
    id: asString(
      firstDefined(
        getByAliases(payload, ["id", "reportId"]),
        `${model.reportType}-${model.selectedDate || "preview"}`
      )
    ),
    projectId: asString(firstDefined(getByAliases(payload, ["projectId"]), getByAliases(meta, ["projectId"])), ""),
    year,
    weekNo,
    startDate: asString(
      firstDefined(
        getByAliases(payload, ["startDate"]),
        parsedRange.startDate,
        model.selectedDate
      ),
      model.selectedDate
    ),
    endDate: asString(
      firstDefined(
        getByAliases(payload, ["endDate"]),
        parsedRange.endDate,
        model.selectedDate
      ),
      model.selectedDate
    ),
    title: asString(
      firstDefined(
        getByAliases(payload, ["title"]),
        model.title,
        model.documentTitle
      ),
      model.documentTitle
    ),
    summary: {
      projectName: asString(
        firstDefined(
          getByAliases(summary, ["projectName"]),
          getByAliases(payload, ["projectName"]),
          getByAliases(meta, ["projectName"]),
          model.projectName
        ),
        "-"
      ),
      contractNo: asString(
        firstDefined(
          getByAliases(summary, ["contractNo", "contractNumber"]),
          getByAliases(payload, ["contractNo", "contractNumber"]),
          getByAliases(meta, ["contractNo", "contractNumber"])
        ),
        "-"
      ),
      installmentLabel: asString(
        firstDefined(
          getByAliases(summary, ["installmentLabel"]),
          getByAliases(payload, ["installmentLabel"]),
          getByAliases(meta, ["periodNo"]),
          getByAliases(payload, ["periodNo"]),
          model.reportType === "MONTHLY"
            ? getByAliases(payload, ["month", "monthNo"])
            : getByAliases(payload, ["weekNo"])
        ),
        "-"
      ),
      contractorName: asString(
        firstDefined(
          getByAliases(summary, ["contractorName", "contractor"]),
          getByAliases(payload, ["contractorName", "contractor"]),
          getByAliases(meta, ["contractorName", "contractor"])
        ),
        "-"
      ),
      siteLocation: asString(
        firstDefined(
          getByAliases(summary, ["siteLocation", "location"]),
          getByAliases(payload, ["siteLocation", "location"]),
          getByAliases(meta, ["siteLocation", "location"])
        ),
        "-"
      ),
      contractStart: asString(
        firstDefined(
          getByAliases(summary, ["contractStart", "startDate"]),
          getByAliases(payload, ["contractStart"]),
          getByAliases(meta, ["contractStart", "startDate"])
        ),
        "-"
      ),
      contractEnd: asString(
        firstDefined(
          getByAliases(summary, ["contractEnd", "endDate"]),
          getByAliases(payload, ["contractEnd"]),
          getByAliases(meta, ["contractEnd", "endDate"])
        ),
        "-"
      ),
      contractValue: asString(
        firstDefined(
          getByAliases(summary, ["contractValue", "budget", "projectValue"]),
          getByAliases(payload, ["contractValue", "budget", "projectValue"]),
          getByAliases(meta, ["contractValue", "budget", "projectValue"])
        ),
        "-"
      ),
      procurementMethod: asString(
        firstDefined(
          getByAliases(summary, ["procurementMethod", "purchaseMethod"]),
          getByAliases(payload, ["procurementMethod", "purchaseMethod"]),
          getByAliases(meta, ["procurementMethod", "purchaseMethod"])
        ),
        "-"
      ),
      periodNo: asString(
        firstDefined(
          getByAliases(summary, ["periodNo"]),
          getByAliases(payload, ["periodNo"]),
          getByAliases(meta, ["periodNo"])
        ),
        ""
      ) || undefined,
    },
    timeSummary: existingStructured
      ? (getByAliases(payload, ["timeSummary"]) as WeeklyTimeSummary)
      : makeWeeklyTimeSummary(payload, model.reportType),
    workPerformedWeekly: existingStructured
      ? (firstDefined(
          getByAliases(payload, ["workPerformedWeekly"]),
          getByAliases(payload, ["workPerformedMonthly"])
        ) as WeeklyWorkItem[])
      : makeWeeklyWorkItems(payload),
    comments: asString(
      firstDefined(
        getByAliases(payload, ["comments", "comment", "supervisorComment", "controllerComment"]),
        model.summary
      ),
      "-"
    ),
    problemsAndObstacles: existingStructured
      ? (firstDefined(
          getByAliases(payload, ["problemsAndObstacles"]),
          getByAliases(payload, ["issues"])
        ) as WeeklyProblemItem[])
      : makeWeeklyProblems(payload),
    safety: {
      note: asString(
        firstDefined(
          getByAliases(toRecord(getByAliases(payload, ["safety", "safetySummary", "safetyStats"])), ["note", "remark", "remarks"]),
          getByAliases(payload, ["safetyNote", "safetyRemark"])
        ),
        "-"
      ),
      accidentCount: (() => {
        const safety = toRecord(getByAliases(payload, ["safety", "safetySummary", "safetyStats"])) || {};
        const raw = firstDefined(
          getByAliases(safety, ["accidentCount", "accident", "accidents"]),
          getByAliases(payload, ["accidentCount", "accident"])
        );
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      injuredCount: (() => {
        const safety = toRecord(getByAliases(payload, ["safety", "safetySummary", "safetyStats"])) || {};
        const raw = firstDefined(
          getByAliases(safety, ["injuredCount", "injuryCount", "injury", "injuries"]),
          getByAliases(payload, ["injuredCount", "injuryCount", "injury"])
        );
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
      lostTimeCount: (() => {
        const safety = toRecord(getByAliases(payload, ["safety", "safetySummary", "safetyStats"])) || {};
        const raw = firstDefined(
          getByAliases(safety, ["lostTimeCount", "lostTime", "losttime"]),
          getByAliases(payload, ["lostTimeCount", "lostTime"])
        );
        if (raw == null || raw === "") return null;
        const parsed = asNumber(raw, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
    },
    progressByCategory: existingStructured
      ? ((getByAliases(payload, ["progressByCategory"]) as WeeklyProgressItem[]) || [])
      : makeWeeklyProgress(payload, model.reportType),
    supervisors: existingStructured
      ? (((getByAliases(payload, ["supervisors"]) as WeeklySupervisor[]) || []).filter(
          (item) => item?.name || item?.role
        ))
      : makeWeeklySupervisors(payload, meta),
    createdAt: asString(firstDefined(getByAliases(payload, ["createdAt"])), "") || undefined,
    updatedAt: asString(firstDefined(getByAliases(payload, ["updatedAt"])), "") || undefined,
  };

  return structuredModel;
}

function prettyLabel(key: string) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
            <div className="text-sm font-semibold">ไม่พบ field ที่ map ได้ครบจาก payload ใน DB</div>
            <div className="mt-1 text-xs opacity-80">
              ด้านล่างคือข้อมูลดิบที่ API ส่งมา เพื่อใช้ตรวจ key จริงของ Weekly/Monthly payload
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

  const payloadEntries = Object.entries(model.payload || {});
  const metaEntries = Object.entries(model.projectMeta || {}).filter(
    ([k, v]) => k !== "supervisors" && v != null && String(v).trim() !== ""
  );

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[794px] rounded-[28px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-8",
        printMode &&
          "max-w-none rounded-none border-0 bg-white p-0 text-slate-900 shadow-none dark:border-0 dark:bg-white dark:text-slate-900"
      )}
    >
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            {model.reportType} Report
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {model.documentTitle || "Report Preview"}
          </h1>
          <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <div>โครงการ: {model.projectName || "-"}</div>
            <div>ช่วงรายงาน: {model.periodLabel || "-"}</div>
            <div>อ้างอิงวันที่เลือก: {model.selectedDate || "-"}</div>
          </div>
        </div>
      </div>

      {model.summary ? (
        <section className="mt-6">
          <DebugCard label="summary" value={model.summary} />
        </section>
      ) : null}

      {metaEntries.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Project Information
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {metaEntries.map(([k, v]) => (
              <DebugCard key={k} label={prettyLabel(k)} value={v} />
            ))}
          </div>
        </section>
      ) : null}

      {model.sourceReportIds?.length ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Source Reports
          </h2>
          <div className="mt-3 grid gap-2">
            {model.sourceReportIds.map((id) => (
              <div
                key={id}
                className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200"
              >
                {id}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Preview Data</h2>
        {payloadEntries.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            ไม่พบ payload สำหรับแสดงผล
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {payloadEntries.map(([k, v]) => (
              <DebugCard key={k} label={prettyLabel(k)} value={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default SummaryAggregatePreview;