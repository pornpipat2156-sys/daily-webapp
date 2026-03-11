// components/SummaryAggregatePreview.tsx
"use client";

import { useMemo, type ReactNode } from "react";

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

function str(value: unknown, fallback = "-") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function num(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function primitiveOrDash(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
  return "-";
}

function extractFirst<T>(...values: unknown[]): T | undefined {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value as T;
  }
  return undefined;
}

function getByAliases(record: AnyRecord | null | undefined, aliases: string[]) {
  if (!record) return undefined;

  for (const key of aliases) {
    if (key in record) return record[key];
  }

  const loweredEntries = Object.entries(record).map(([k, v]) => [k.toLowerCase(), v] as const);
  for (const alias of aliases) {
    const found = loweredEntries.find(([k]) => k === alias.toLowerCase());
    if (found) return found[1];
  }

  return undefined;
}

function formatDateBE(input?: string | null) {
  const raw = String(input ?? "").trim();
  if (!raw || raw === "-") return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear() + 543;
  return `${day}/${month}/${year}`;
}

function formatDateThai(input?: string | null) {
  const raw = String(input ?? "").trim();
  if (!raw || raw === "-") return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatInteger(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function formatNumber(value?: number | null, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function textOrDash(value?: string | null) {
  const v = String(value ?? "").trim();
  return v || "-";
}

function titleCaseLabel(key: string) {
  const normalized = String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  const dictionary: Record<string, string> = {
    contractNo: "สัญญาจ้าง",
    contractStart: "เริ่มสัญญา",
    contractEnd: "สิ้นสุดสัญญา",
    siteLocation: "สถานที่ก่อสร้าง",
    contractValue: "วงเงินค่าก่อสร้าง",
    contractorName: "ผู้รับจ้าง",
    procurementMethod: "วิธีจัดซื้อจัดจ้าง",
    periodNo: "งวดงาน",
    weekNo: "สัปดาห์",
    month: "เดือน",
    year: "ปี",
  };

  return dictionary[key] || normalized || key;
}

type NormalizedSummary = {
  weekNo: number;
  monthNo: number;
  year: number;
  projectSummary: {
    projectName: string;
    contractNo: string;
    installmentLabel: string;
    contractorName: string;
    siteLocation: string;
    contractStart: string;
    contractEnd: string;
    contractValue: string;
    procurementMethod: string;
  };
  timeSummary: {
    contractDays: number | null;
    previousUsedDays: number | null;
    currentPeriodDays: number | null;
    accumulatedDays: number | null;
    remainingDays: number | null;
    varianceDays: number | null;
  };
  workItems: Array<{
    id: string;
    description: string;
    qty: number | null;
    unit: string | null;
    location: string | null;
    remark: string | null;
  }>;
  comments: string;
  problems: Array<{
    id: string;
    topic: string;
    impact: string | null;
    solution: string | null;
  }>;
  safety: {
    note: string;
    accidentCount: number | null;
    injuredCount: number | null;
    lostTimeCount: number | null;
  };
  progress: Array<{
    id: string;
    category: string;
    weightPercent: number;
    previousPercent: number;
    currentPercent: number;
    accumulatedPercent: number;
    remainingPercent: number;
    plannedPercent: number | null;
    variancePercent: number | null;
  }>;
  supervisors: Array<{
    name: string;
    role: string;
  }>;
  payload: AnyRecord;
  meta: AnyRecord;
};

function normalizeSummaryData(model: SummaryDocumentModel): NormalizedSummary {
  const payload = toRecord(model.payload) || {};
  const meta = toRecord(model.projectMeta) || {};

  const header =
    toRecord(
      extractFirst(
        getByAliases(payload, ["header", "reportHeader", "documentHeader"]),
        getByAliases(payload, ["summary"])
      )
    ) || {};

  const summaryBlock =
    toRecord(getByAliases(payload, ["summary", "projectSummary", "weeklySummary", "monthlySummary"])) || {};

  const timeSummary =
    toRecord(getByAliases(payload, ["timeSummary", "durationSummary", "scheduleSummary"])) || {};

  const safety =
    toRecord(getByAliases(payload, ["safety", "safetySummary", "safetyStats"])) || {};

  const workItemsRaw =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payload, ["workPerformedWeekly", "workPerformedMonthly", "mergedWorkItems", "workItems", "works"])
      )
    ) || [];

  const problemsRaw =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payload, ["problemsAndObstacles", "issues", "issueSummary", "obstacles"])
      )
    ) || [];

  const progressRaw =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payload, ["progressByCategory", "progressItems", "progressRows"]),
        getByAliases(payload, ["progress"])
      )
    ) || [];

  const supervisorsRaw =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payload, ["supervisors", "approvedBy", "signers"]),
        getByAliases(meta, ["supervisors", "approvedBy", "signers"])
      )
    ) || [];

  const weekNo = num(
    extractFirst(
      getByAliases(payload, ["weekNo"]),
      getByAliases(header, ["weekNo"]),
      getByAliases(meta, ["weekNo"])
    ),
    0
  );

  const monthNo = num(
    extractFirst(
      getByAliases(payload, ["month", "monthNo"]),
      getByAliases(header, ["month", "monthNo"])
    ),
    0
  );

  const year = num(
    extractFirst(
      getByAliases(payload, ["year"]),
      getByAliases(header, ["year"])
    ),
    0
  );

  const projectSummary = {
    projectName: str(
      extractFirst(
        getByAliases(summaryBlock, ["projectName"]),
        getByAliases(payload, ["projectName"]),
        getByAliases(meta, ["projectName"]),
        model.projectName
      ),
      "-"
    ),
    contractNo: str(
      extractFirst(
        getByAliases(summaryBlock, ["contractNo", "contractNumber"]),
        getByAliases(payload, ["contractNo", "contractNumber"]),
        getByAliases(meta, ["contractNo", "contractNumber"])
      ),
      "-"
    ),
    installmentLabel: str(
      extractFirst(
        getByAliases(summaryBlock, ["installmentLabel"]),
        getByAliases(payload, ["installmentLabel"]),
        getByAliases(meta, ["periodNo"]),
        getByAliases(payload, ["periodNo"]),
        getByAliases(meta, ["weekNo"])
      ),
      "-"
    ),
    contractorName: str(
      extractFirst(
        getByAliases(summaryBlock, ["contractorName", "contractor"]),
        getByAliases(payload, ["contractorName", "contractor"]),
        getByAliases(meta, ["contractorName", "contractor"])
      ),
      "-"
    ),
    siteLocation: str(
      extractFirst(
        getByAliases(summaryBlock, ["siteLocation", "location"]),
        getByAliases(payload, ["siteLocation", "location"]),
        getByAliases(meta, ["siteLocation", "location"])
      ),
      "-"
    ),
    contractStart: str(
      extractFirst(
        getByAliases(summaryBlock, ["contractStart", "startDate"]),
        getByAliases(payload, ["contractStart", "startDate"]),
        getByAliases(meta, ["contractStart", "startDate"])
      ),
      "-"
    ),
    contractEnd: str(
      extractFirst(
        getByAliases(summaryBlock, ["contractEnd", "endDate"]),
        getByAliases(payload, ["contractEnd", "endDate"]),
        getByAliases(meta, ["contractEnd", "endDate"])
      ),
      "-"
    ),
    contractValue: str(
      extractFirst(
        getByAliases(summaryBlock, ["contractValue", "budget", "projectValue"]),
        getByAliases(payload, ["contractValue", "budget", "projectValue"]),
        getByAliases(meta, ["contractValue", "budget", "projectValue"])
      ),
      "-"
    ),
    procurementMethod: str(
      extractFirst(
        getByAliases(summaryBlock, ["procurementMethod", "purchaseMethod"]),
        getByAliases(payload, ["procurementMethod", "purchaseMethod"]),
        getByAliases(meta, ["procurementMethod", "purchaseMethod"])
      ),
      "-"
    ),
  };

  const normalizedTimeSummary = {
    contractDays: extractFirst<number>(
      num(getByAliases(timeSummary, ["contractDays", "accordingToContract", "plan"]), NaN),
      num(getByAliases(payload, ["contractDays"]), NaN)
    ),
    previousUsedDays: extractFirst<number>(
      num(getByAliases(timeSummary, ["previousUsedDays", "beforeThisWeek", "before", "previous"]), NaN)
    ),
    currentPeriodDays: extractFirst<number>(
      num(getByAliases(timeSummary, ["currentWeekDays", "currentMonthDays", "thisWeek", "thisMonth", "thisPeriod"]), NaN)
    ),
    accumulatedDays: extractFirst<number>(
      num(getByAliases(timeSummary, ["accumulatedDays", "cumulative", "accumulated"]), NaN)
    ),
    remainingDays: extractFirst<number>(
      num(getByAliases(timeSummary, ["remainingDays", "remaining", "balance"]), NaN)
    ),
    varianceDays: extractFirst<number>(
      num(getByAliases(timeSummary, ["varianceDays", "deviation", "variance", "delay"]), NaN)
    ),
  };

  const comments = str(
    extractFirst(
      getByAliases(payload, ["comments", "comment", "supervisorComment", "controllerComment"]),
      model.summary
    ),
    "-"
  );

  const normalizedWorkItems = workItemsRaw.map((row, index) => ({
    id: str(extractFirst(row.id, row.code), `work-${index + 1}`),
    description: str(
      extractFirst(
        getByAliases(row, ["description", "desc", "workName", "item", "title"])
      ),
      "-"
    ),
    qty: (() => {
      const value = extractFirst(
        getByAliases(row, ["qty", "quantity", "amount"])
      );
      const parsed = num(value, NaN);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    unit: str(getByAliases(row, ["unit"]), "").trim() || null,
    location: str(getByAliases(row, ["location", "position", "area"]), "").trim() || null,
    remark: str(getByAliases(row, ["remark", "remarks", "note", "materialDelivered"]), "").trim() || null,
  }));

  const normalizedProblems = problemsRaw.map((row, index) => ({
    id: str(extractFirst(row.id, row.code), `problem-${index + 1}`),
    topic: str(extractFirst(getByAliases(row, ["topic", "title", "problem", "detail"])), "-"),
    impact: str(getByAliases(row, ["impact", "effect", "result"]), "").trim() || null,
    solution: str(getByAliases(row, ["solution", "fix", "resolution", "action"]), "").trim() || null,
  }));

  const normalizedSafety = {
    note: str(
      extractFirst(
        getByAliases(safety, ["note", "remark", "remarks"]),
        getByAliases(payload, ["safetyNote", "safetyRemark"])
      ),
      "-"
    ),
    accidentCount: (() => {
      const parsed = num(
        extractFirst(
          getByAliases(safety, ["accidentCount", "accident", "accidents"]),
          getByAliases(payload, ["accidentCount", "accident"])
        ),
        NaN
      );
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    injuredCount: (() => {
      const parsed = num(
        extractFirst(
          getByAliases(safety, ["injuredCount", "injuryCount", "injury", "injuries"]),
          getByAliases(payload, ["injuredCount", "injuryCount", "injury"])
        ),
        NaN
      );
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    lostTimeCount: (() => {
      const parsed = num(
        extractFirst(
          getByAliases(safety, ["lostTimeCount", "lostTime", "losttime"]),
          getByAliases(payload, ["lostTimeCount", "lostTime"])
        ),
        NaN
      );
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  };

  const normalizedProgress = progressRaw.map((row, index) => ({
    id: str(extractFirst(row.id, row.code), `progress-${index + 1}`),
    category: str(
      extractFirst(getByAliases(row, ["category", "name", "section", "workType", "title"])),
      `หมวดงาน ${index + 1}`
    ),
    weightPercent: num(getByAliases(row, ["weightPercent", "weight", "weightPct", "weightPercentage"]), 0),
    previousPercent: num(getByAliases(row, ["previousPercent", "before", "previous", "beforePercent"]), 0),
    currentPercent: num(getByAliases(row, ["weeklyPercent", "monthlyPercent", "currentPercent", "thisWeek", "thisMonth", "thisPeriod"]), 0),
    accumulatedPercent: num(getByAliases(row, ["accumulatedPercent", "cumulativePercent", "cumulative", "accumulated"]), 0),
    remainingPercent: num(getByAliases(row, ["remainingPercent", "remaining", "balance"]), 0),
    plannedPercent: (() => {
      const parsed = num(getByAliases(row, ["plannedPercent", "planPercent", "plan", "planned"]), NaN);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    variancePercent: (() => {
      const parsed = num(getByAliases(row, ["variancePercent", "deviationPercent", "deviation", "variance", "delay"]), NaN);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
  }));

  const normalizedSupervisors = supervisorsRaw
    .map((item) => ({
      name: str(item.name, ""),
      role: str(item.role, ""),
    }))
    .filter((item) => item.name || item.role);

  return {
    weekNo,
    monthNo,
    year,
    projectSummary,
    timeSummary: {
      contractDays: Number.isFinite(normalizedTimeSummary.contractDays as number)
        ? (normalizedTimeSummary.contractDays as number)
        : null,
      previousUsedDays: Number.isFinite(normalizedTimeSummary.previousUsedDays as number)
        ? (normalizedTimeSummary.previousUsedDays as number)
        : null,
      currentPeriodDays: Number.isFinite(normalizedTimeSummary.currentPeriodDays as number)
        ? (normalizedTimeSummary.currentPeriodDays as number)
        : null,
      accumulatedDays: Number.isFinite(normalizedTimeSummary.accumulatedDays as number)
        ? (normalizedTimeSummary.accumulatedDays as number)
        : null,
      remainingDays: Number.isFinite(normalizedTimeSummary.remainingDays as number)
        ? (normalizedTimeSummary.remainingDays as number)
        : null,
      varianceDays: Number.isFinite(normalizedTimeSummary.varianceDays as number)
        ? (normalizedTimeSummary.varianceDays as number)
        : null,
    },
    workItems: normalizedWorkItems,
    comments,
    problems: normalizedProblems,
    safety: normalizedSafety,
    progress: normalizedProgress,
    supervisors: normalizedSupervisors,
    payload,
    meta,
  };
}

function Cell({
  children,
  className,
  header = false,
  align = "center",
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  header?: boolean;
  align?: "left" | "center" | "right";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border border-black px-2 py-1.5 text-[11px] leading-tight text-black",
        header && "bg-[#efe7d7] font-bold",
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </td>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td
        colSpan={8}
        className="border border-black bg-[#dfeedd] px-2 py-2 text-center text-[12px] font-bold text-black"
      >
        {children}
      </td>
    </tr>
  );
}

function SignatureGrid({ items }: { items: Array<{ name: string; role: string }> }) {
  const clean = (items || []).filter((x) => x?.name?.trim() || x?.role?.trim());

  if (!clean.length) {
    return (
      <div className="border border-black px-3 py-4 text-center text-[12px] text-black">
        ยังไม่มีข้อมูลผู้ลงนาม
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 px-2 py-3 md:grid-cols-2 xl:grid-cols-3">
      {clean.map((it, i) => (
        <div
          key={`sign-${i}`}
          className="min-h-[78px] border border-black px-3 py-3 text-center text-[11px] text-black"
        >
          <div className="pt-5">ลงชื่อ ................................</div>
          <div className="mt-2">({it.name || "-"})</div>
          <div className="mt-1">{it.role || " "}</div>
        </div>
      ))}
    </div>
  );
}

function MetaFallback({
  projectMeta,
  payload,
}: {
  projectMeta: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const metaEntries = Object.entries(projectMeta).filter(
    ([k, v]) => k !== "supervisors" && v != null && String(v).trim() !== ""
  );

  const payloadEntries = Object.entries(payload).filter(
    ([, v]) => v != null && !(Array.isArray(v) && v.length === 0)
  );

  if (!metaEntries.length && !payloadEntries.length) return null;

  return (
    <div className="mt-4 rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
        ข้อมูลดิบจาก DB
      </h3>

      {metaEntries.length ? (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Project Meta
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {metaEntries.map(([k, v]) => (
              <div
                key={`meta-${k}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <div className="font-semibold">{titleCaseLabel(k)}</div>
                <div className="mt-1 break-words">{primitiveOrDash(v)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {payloadEntries.length ? (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Payload
          </div>
          <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      ) : null}
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
  const normalized = useMemo(() => normalizeSummaryData(model), [model]);

  const reportLabel =
    model.reportType === "WEEKLY"
      ? "รายงานการควบคุมงานก่อสร้างประจำสัปดาห์ (WEEKLY REPORT)"
      : "รายงานการควบคุมงานก่อสร้างประจำเดือน (MONTHLY REPORT)";

  const periodLabelTop =
    model.reportType === "WEEKLY"
      ? `สัปดาห์ที่ ${normalized.weekNo || 0}`
      : normalized.monthNo && normalized.year
      ? `เดือนที่ ${normalized.monthNo} / ${normalized.year}`
      : "รายงานประจำเดือน";

  const currentPeriodHeading = model.reportType === "WEEKLY" ? "สัปดาห์นี้" : "เดือนนี้";
  const currentPeriodPercentHeading = model.reportType === "WEEKLY" ? "สัปดาห์นี้ (%)" : "เดือนนี้ (%)";
  const workSectionTitle = model.reportType === "WEEKLY" ? "ผลงานที่ดำเนินการประจำสัปดาห์" : "ผลงานที่ดำเนินการประจำเดือน";

  const totalWeight = normalized.progress.reduce((sum, item) => sum + Number(item.weightPercent || 0), 0);
  const totalPrev = normalized.progress.reduce((sum, item) => sum + Number(item.previousPercent || 0), 0);
  const totalCurrent = normalized.progress.reduce((sum, item) => sum + Number(item.currentPercent || 0), 0);
  const totalAccum = normalized.progress.reduce((sum, item) => sum + Number(item.accumulatedPercent || 0), 0);
  const totalRemain = normalized.progress.reduce((sum, item) => sum + Number(item.remainingPercent || 0), 0);

  const hasStructuredData =
    normalized.workItems.length > 0 ||
    normalized.problems.length > 0 ||
    normalized.progress.length > 0 ||
    normalized.supervisors.length > 0 ||
    normalized.projectSummary.contractNo !== "-" ||
    normalized.projectSummary.contractorName !== "-" ||
    normalized.comments !== "-";

  return (
    <div
      className={cn(
        "w-full",
        printMode
          ? "bg-white"
          : "rounded-[28px] border border-slate-200/70 bg-white/90 p-4 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-950/75 dark:shadow-none"
      )}
    >
      <div
        className={cn(
          "mx-auto w-full overflow-hidden rounded-[24px] border-2 border-black bg-[#f8f8f3]",
          printMode ? "max-w-none" : "max-w-[1040px]"
        )}
      >
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-[130px] border border-black bg-white p-3 align-middle">
                <div className="mx-auto flex h-[94px] w-[94px] items-center justify-center rounded-full border-[4px] border-[#4f7d55] bg-[#efe7f7] text-center text-[11px] font-bold leading-tight text-[#3e3252]">
                  CMU
                  <br />
                  DAILY
                  <br />
                  WEBAPP
                </div>
              </td>

              <td className="border border-black bg-[#eadff2] px-4 py-4 text-center text-black">
                <div className="text-[14px] font-bold md:text-[16px]">{reportLabel}</div>
                <div className="mt-1 text-[12px] font-semibold">{periodLabelTop}</div>
                <div className="mt-1 text-[12px]">
                  ช่วงวันที่ {formatDateBE(model.periodLabel.includes("ถึง") ? model.periodLabel.split("ถึง")[0].trim() : model.selectedDate)}{" "}
                  {model.periodLabel.includes("ถึง")
                    ? `ถึง ${formatDateBE(model.periodLabel.split("ถึง")[1]?.trim() || "")}`
                    : ""}
                </div>
                <div className="mt-1 text-[12px]">
                  โครงการ : {textOrDash(normalized.projectSummary.projectName)}
                </div>
              </td>
            </tr>

            <tr>
              <Cell header align="left" className="w-[19%]">สัญญาจ้าง</Cell>
              <Cell align="left" className="w-[31%]">{textOrDash(normalized.projectSummary.contractNo)}</Cell>
              <Cell header align="left" className="w-[19%]">สถานที่ก่อสร้าง</Cell>
              <Cell align="left" className="w-[31%]">{textOrDash(normalized.projectSummary.siteLocation)}</Cell>
            </tr>

            <tr>
              <Cell header align="left">งวดงาน</Cell>
              <Cell align="left">{textOrDash(normalized.projectSummary.installmentLabel)}</Cell>
              <Cell header align="left">วงเงินค่าก่อสร้าง</Cell>
              <Cell align="left">{textOrDash(normalized.projectSummary.contractValue)}</Cell>
            </tr>

            <tr>
              <Cell header align="left">เริ่มสัญญา</Cell>
              <Cell align="left">{formatDateBE(normalized.projectSummary.contractStart)}</Cell>
              <Cell header align="left">ผู้รับจ้าง</Cell>
              <Cell align="left">{textOrDash(normalized.projectSummary.contractorName)}</Cell>
            </tr>

            <tr>
              <Cell header align="left">สิ้นสุดสัญญา</Cell>
              <Cell align="left">{formatDateBE(normalized.projectSummary.contractEnd)}</Cell>
              <Cell header align="left">วิธีจัดซื้อจัดจ้าง</Cell>
              <Cell align="left">{textOrDash(normalized.projectSummary.procurementMethod)}</Cell>
            </tr>

            <SectionTitle>สรุประยะเวลา</SectionTitle>
            <tr>
              <Cell header>รายการ</Cell>
              <Cell header>ตามสัญญา</Cell>
              <Cell header>ก่อนหน้า</Cell>
              <Cell header>{currentPeriodHeading}</Cell>
              <Cell header>สะสม</Cell>
              <Cell header>คงเหลือ</Cell>
              <Cell header>คลาดเคลื่อน</Cell>
              <Cell header className="hidden">-</Cell>
            </tr>
            <tr>
              <Cell className="font-medium">จำนวนวัน</Cell>
              <Cell>{formatInteger(normalized.timeSummary.contractDays)}</Cell>
              <Cell>{formatInteger(normalized.timeSummary.previousUsedDays)}</Cell>
              <Cell>{formatInteger(normalized.timeSummary.currentPeriodDays)}</Cell>
              <Cell>{formatInteger(normalized.timeSummary.accumulatedDays)}</Cell>
              <Cell>{formatInteger(normalized.timeSummary.remainingDays)}</Cell>
              <Cell>{formatInteger(normalized.timeSummary.varianceDays)}</Cell>
              <Cell className="hidden">-</Cell>
            </tr>

            <SectionTitle>{workSectionTitle}</SectionTitle>
            <tr>
              <Cell header>ลำดับ</Cell>
              <Cell header>รายการงาน</Cell>
              <Cell header>ตำแหน่ง</Cell>
              <Cell header>ปริมาณ</Cell>
              <Cell header>หน่วย</Cell>
              <Cell header colSpan={3}>หมายเหตุ</Cell>
            </tr>
            {normalized.workItems.length ? (
              normalized.workItems.map((item, index) => (
                <tr key={item.id}>
                  <Cell>{index + 1}</Cell>
                  <Cell align="left">{textOrDash(item.description)}</Cell>
                  <Cell align="left">{textOrDash(item.location)}</Cell>
                  <Cell align="right">{item.qty == null ? "-" : formatNumber(item.qty, 2)}</Cell>
                  <Cell>{textOrDash(item.unit)}</Cell>
                  <Cell colSpan={3} align="left">{textOrDash(item.remark)}</Cell>
                </tr>
              ))
            ) : (
              <tr>
                <Cell>1</Cell>
                <Cell colSpan={7} align="center">ไม่มีรายการงาน</Cell>
              </tr>
            )}

            <SectionTitle>ความคิดเห็นผู้ควบคุมงาน</SectionTitle>
            <tr>
              <Cell colSpan={8} align="left" className="px-3 py-3">
                {textOrDash(normalized.comments)}
              </Cell>
            </tr>

            <SectionTitle>ปัญหาและอุปสรรค</SectionTitle>
            <tr>
              <Cell header>ลำดับ</Cell>
              <Cell header colSpan={2}>หัวข้อ</Cell>
              <Cell header colSpan={3}>ผลกระทบ</Cell>
              <Cell header colSpan={2}>แนวทางแก้ไข</Cell>
            </tr>
            {normalized.problems.length ? (
              normalized.problems.map((item, index) => (
                <tr key={item.id}>
                  <Cell>{index + 1}</Cell>
                  <Cell align="left" colSpan={2}>{textOrDash(item.topic)}</Cell>
                  <Cell align="left" colSpan={3}>{textOrDash(item.impact)}</Cell>
                  <Cell align="left" colSpan={2}>{textOrDash(item.solution)}</Cell>
                </tr>
              ))
            ) : (
              <tr>
                <Cell>1</Cell>
                <Cell colSpan={7} align="center">ไม่มีปัญหาและอุปสรรค</Cell>
              </tr>
            )}

            <SectionTitle>ความปลอดภัยในการทำงาน</SectionTitle>
            <tr>
              <Cell header colSpan={2}>อุบัติเหตุ</Cell>
              <Cell header colSpan={2}>บาดเจ็บ</Cell>
              <Cell header colSpan={2}>Lost Time</Cell>
              <Cell header colSpan={2}>หมายเหตุ</Cell>
            </tr>
            <tr>
              <Cell colSpan={2}>{formatInteger(normalized.safety.accidentCount ?? 0)}</Cell>
              <Cell colSpan={2}>{formatInteger(normalized.safety.injuredCount ?? 0)}</Cell>
              <Cell colSpan={2}>{formatInteger(normalized.safety.lostTimeCount ?? 0)}</Cell>
              <Cell colSpan={2} align="left">{textOrDash(normalized.safety.note)}</Cell>
            </tr>

            <SectionTitle>สรุปความก้าวหน้า</SectionTitle>
            <tr>
              <Cell header>หมวดงาน</Cell>
              <Cell header>น้ำหนัก (%)</Cell>
              <Cell header>ก่อนหน้า (%)</Cell>
              <Cell header>{currentPeriodPercentHeading}</Cell>
              <Cell header>สะสม (%)</Cell>
              <Cell header>คงเหลือ (%)</Cell>
              <Cell header>แผน (%)</Cell>
              <Cell header>คลาดเคลื่อน (%)</Cell>
            </tr>
            {normalized.progress.length ? (
              <>
                {normalized.progress.map((item) => (
                  <tr key={item.id}>
                    <Cell align="left">{textOrDash(item.category)}</Cell>
                    <Cell align="right">{formatNumber(item.weightPercent)}</Cell>
                    <Cell align="right">{formatNumber(item.previousPercent)}</Cell>
                    <Cell align="right">{formatNumber(item.currentPercent)}</Cell>
                    <Cell align="right">{formatNumber(item.accumulatedPercent)}</Cell>
                    <Cell align="right">{formatNumber(item.remainingPercent)}</Cell>
                    <Cell align="right">{formatNumber(item.plannedPercent)}</Cell>
                    <Cell align="right">{formatNumber(item.variancePercent)}</Cell>
                  </tr>
                ))}
                <tr>
                  <Cell className="font-bold">รวม</Cell>
                  <Cell align="right" className="font-bold">{formatNumber(totalWeight)}</Cell>
                  <Cell align="right" className="font-bold">{formatNumber(totalPrev)}</Cell>
                  <Cell align="right" className="font-bold">{formatNumber(totalCurrent)}</Cell>
                  <Cell align="right" className="font-bold">{formatNumber(totalAccum)}</Cell>
                  <Cell align="right" className="font-bold">{formatNumber(totalRemain)}</Cell>
                  <Cell align="right" className="font-bold">-</Cell>
                  <Cell align="right" className="font-bold">-</Cell>
                </tr>
              </>
            ) : (
              <tr>
                <Cell colSpan={8} align="center">ยังไม่มีตารางสรุปความก้าวหน้า</Cell>
              </tr>
            )}

            <SectionTitle>ผู้ควบคุมงาน / ผู้ลงนาม</SectionTitle>
            <tr>
              <td colSpan={8} className="border border-black bg-white p-0">
                <SignatureGrid items={normalized.supervisors} />
              </td>
            </tr>

            <tr>
              <td colSpan={8} className="border border-black bg-white px-3 py-2 text-[11px] text-black">
                <span className="font-semibold">หมายเหตุ:</span>{" "}
                เอกสารนี้เป็นข้อมูล {model.reportType === "WEEKLY" ? "Weekly Report" : "Monthly Report"} ที่ถูกสรุปจากระบบและจัดเก็บในฐานข้อมูล
              </td>
            </tr>

            <tr>
              <td colSpan={8} className="border border-black bg-white px-3 py-2 text-[11px] text-black">
                วันที่สร้างข้อมูลล่าสุด: {formatDateThai(model.selectedDate)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!printMode && !hasStructuredData ? (
        <MetaFallback projectMeta={normalized.meta} payload={normalized.payload} />
      ) : null}
    </div>
  );
}

export default SummaryAggregatePreview;