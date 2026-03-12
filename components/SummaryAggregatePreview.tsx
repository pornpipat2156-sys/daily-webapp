"use client";

import React from "react";

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

type DirectWorkItem = {
  id: string;
  description: string;
  qty: number | null;
  unit: string | null;
  location: string | null;
  remark: string | null;
};

type DirectProblemItem = {
  id: string;
  topic: string;
  impact: string | null;
  solution: string | null;
};

type DirectPreviewModel = {
  reportType: "WEEKLY" | "MONTHLY";
  weekNo: number;
  monthNo: number;
  year: number;
  projectName: string;
  contractNo: string;
  installmentLabel: string;
  contractorName: string;
  siteLocation: string;
  contractStart: string;
  contractEnd: string;
  contractValue: string;
  procurementMethod: string;
  startDate: string;
  endDate: string;
  comments: string;
  contractDays: number;
  previousUsedDays: number;
  currentPeriodDays: number;
  accumulatedDays: number;
  remainingDays: number;
  varianceDays: number | null;
  workItems: DirectWorkItem[];
  problems: DirectProblemItem[];
  accidentCount: number | null;
  injuredCount: number | null;
  lostTimeCount: number | null;
  safetyNote: string;
  progressRows: Array<{
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
  supervisors: Array<{ name: string; role: string }>;
};

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateThai(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDateBE(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
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

function extractCommentsText(summaryText: string) {
  const text = asString(summaryText, "");
  if (!text) return "-";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const reportIndex = lines.findIndex((line) => line.includes("สรุปรายงานประจำสัปดาห์"));
  if (reportIndex >= 0) {
    return lines.slice(reportIndex).join("\n");
  }

  return text;
}

function buildDirectPreviewModel(model: SummaryDocumentModel): DirectPreviewModel | null {
  if (model.reportType !== "WEEKLY" && model.reportType !== "MONTHLY") {
    return null;
  }

  const payload = toRecord(model.payload) || {};
  const routeMeta = toRecord(model.projectMeta) || {};
  const payloadMeta = toRecord(payload.projectMeta) || {};
  const mergedMeta = {
    periodNo: asString(firstNonEmpty(payloadMeta.periodNo, routeMeta.periodNo), ""),
    contractNo: asString(firstNonEmpty(payloadMeta.contractNo, routeMeta.contractNo), ""),
    contractEnd: asString(firstNonEmpty(payloadMeta.contractEnd, routeMeta.contractEnd), ""),
    projectName: asString(firstNonEmpty(payloadMeta.projectName, routeMeta.projectName, model.projectName), ""),
    siteLocation: asString(firstNonEmpty(payloadMeta.siteLocation, routeMeta.siteLocation), ""),
    contractStart: asString(firstNonEmpty(payloadMeta.contractStart, routeMeta.contractStart), ""),
    contractValue: asString(firstNonEmpty(payloadMeta.contractValue, routeMeta.contractValue), ""),
    contractorName: asString(firstNonEmpty(payloadMeta.contractorName, routeMeta.contractorName), ""),
    procurementMethod: asString(
      firstNonEmpty(payloadMeta.procurementMethod, routeMeta.procurementMethod),
      ""
    ),
  };

  const fallbackRange = parsePeriodRangeFromLabel(model.periodLabel, model.selectedDate);
  const startDate = asString(
    firstNonEmpty(payload.dateStart, payload.startDate, payload.weekStart, fallbackRange.startDate),
    model.selectedDate
  );
  const endDate = asString(
    firstNonEmpty(payload.dateEnd, payload.endDate, payload.weekEnd, fallbackRange.endDate),
    model.selectedDate
  );

  const weekNo = asNumber(firstNonEmpty(payload.weekNo, payload.week, payload.weekNumber), 0);
  const monthNo = asNumber(firstNonEmpty(payload.monthNo, payload.month), 0);
  const year = asNumber(firstNonEmpty(payload.year), new Date(model.selectedDate || Date.now()).getFullYear());

  const workItems = toArray<AnyRecord>(payload.mergedWorkItems)
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

  const normalizedIssues = toArray<string>(payload.normalizedIssues);
  const problems =
    normalizedIssues.length > 0
      ? normalizedIssues.map((topic, index) => ({
          id: `issue-${index + 1}`,
          topic: asString(topic, "-"),
          impact: null,
          solution: null,
        }))
      : toArray<AnyRecord>(firstNonEmpty(payload.problemsAndObstacles, payload.issues)).map((row, index) => ({
          id: asString(firstNonEmpty(row.id, row.code), `issue-${index + 1}`),
          topic: asString(firstNonEmpty(row.topic, row.title, row.problem, row.detail), "-"),
          impact: asString(firstNonEmpty(row.impact, row.effect, row.result), "") || null,
          solution: asString(firstNonEmpty(row.solution, row.fix, row.resolution, row.action), "") || null,
        }));

  const progressRows = toArray<AnyRecord>(
    firstNonEmpty(payload.progressByCategory, payload.progressItems, payload.progressRows)
  ).map((row, index) => {
    const currentPercent =
      model.reportType === "MONTHLY"
        ? firstNonEmpty(row.monthlyPercent, row.currentPercent, row.thisMonth, row.thisPeriod, row.weeklyPercent)
        : firstNonEmpty(row.weeklyPercent, row.currentPercent, row.thisWeek, row.thisPeriod, row.monthlyPercent);

    const plannedRaw = firstNonEmpty(row.plannedPercent, row.planPercent, row.plan, row.planned);
    const varianceRaw = firstNonEmpty(row.variancePercent, row.deviationPercent, row.deviation, row.variance);

    return {
      id: asString(firstNonEmpty(row.id, row.code), `progress-${index + 1}`),
      category: asString(firstNonEmpty(row.category, row.name, row.section, row.workType, row.title), `หมวดงาน ${index + 1}`),
      weightPercent: asNumber(firstNonEmpty(row.weightPercent, row.weight, row.weightPct, row.weightPercentage), 0),
      previousPercent: asNumber(firstNonEmpty(row.previousPercent, row.before, row.previous, row.beforePercent), 0),
      currentPercent: asNumber(currentPercent, 0),
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
    };
  });

  const supervisors = toArray<AnyRecord>(payload.supervisors)
    .map((row) => ({
      name: asString(row.name, ""),
      role: asString(row.role, ""),
    }))
    .filter((row) => row.name || row.role);

  const timeSummary = toRecord(payload.timeSummary) || {};

  return {
    reportType: model.reportType,
    weekNo,
    monthNo,
    year,
    projectName: asString(mergedMeta.projectName, "-"),
    contractNo: asString(mergedMeta.contractNo, "-"),
    installmentLabel:
      mergedMeta.periodNo ||
      (model.reportType === "MONTHLY"
        ? monthNo > 0
          ? `เดือนที่ ${monthNo}`
          : "-"
        : weekNo > 0
          ? `สัปดาห์ที่ ${weekNo}`
          : "-"),
    contractorName: asString(mergedMeta.contractorName, "-"),
    siteLocation: asString(mergedMeta.siteLocation, "-"),
    contractStart: asString(mergedMeta.contractStart, "-"),
    contractEnd: asString(mergedMeta.contractEnd, "-"),
    contractValue: asString(mergedMeta.contractValue, "-"),
    procurementMethod: asString(mergedMeta.procurementMethod, "-"),
    startDate,
    endDate,
    comments: extractCommentsText(asString(model.summary, "")),
    contractDays: asNumber(firstNonEmpty(timeSummary.contractDays, timeSummary.accordingToContract), 0),
    previousUsedDays: asNumber(firstNonEmpty(timeSummary.previousUsedDays, timeSummary.beforeThisWeek), 0),
    currentPeriodDays: asNumber(
      firstNonEmpty(
        model.reportType === "MONTHLY" ? timeSummary.currentMonthDays : timeSummary.currentWeekDays,
        timeSummary.thisMonth,
        timeSummary.thisWeek,
        timeSummary.thisPeriod
      ),
      0
    ),
    accumulatedDays: asNumber(firstNonEmpty(timeSummary.accumulatedDays, timeSummary.cumulative), 0),
    remainingDays: asNumber(firstNonEmpty(timeSummary.remainingDays, timeSummary.remaining), 0),
    varianceDays: (() => {
      const raw = firstNonEmpty(timeSummary.varianceDays, timeSummary.deviation, timeSummary.variance);
      if (raw == null || raw === "") return null;
      const parsed = asNumber(raw, Number.NaN);
      return Number.isFinite(parsed) ? parsed : null;
    })(),
    workItems,
    problems,
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
    safetyNote: asString(firstNonEmpty(payload.safetyNote, payload.safetyRemark, payload.note, payload.remark), "-"),
    progressRows,
    supervisors,
  };
}

function Cell({
  children,
  className,
  header = false,
  align = "center",
  colSpan,
}: {
  children: React.ReactNode;
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

function SectionTitle({ children }: { children: React.ReactNode }) {
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

function SignatureGrid({
  items,
}: {
  items: Array<{ name: string; role: string }>;
}) {
  const clean = items.filter((x) => x?.name?.trim() || x?.role?.trim());

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

function DirectWeeklyPreview({
  model,
}: {
  model: DirectPreviewModel;
}) {
  const currentPeriodHeading = model.reportType === "MONTHLY" ? "เดือนนี้" : "สัปดาห์นี้";
  const currentPeriodPercentHeading = model.reportType === "MONTHLY" ? "เดือนนี้ (%)" : "สัปดาห์นี้ (%)";
  const workSectionTitle = model.reportType === "MONTHLY" ? "ผลงานที่ดำเนินการประจำเดือน" : "ผลงานที่ดำเนินการประจำสัปดาห์";
  const periodTitle =
    model.reportType === "MONTHLY"
      ? model.monthNo > 0
        ? `เดือนที่ ${model.monthNo}`
        : "รายงานประจำเดือน"
      : `สัปดาห์ที่ ${model.weekNo || 0}`;

  const totalWeight = model.progressRows.reduce((sum, item) => sum + Number(item.weightPercent || 0), 0);
  const totalPrev = model.progressRows.reduce((sum, item) => sum + Number(item.previousPercent || 0), 0);
  const totalCurrent = model.progressRows.reduce((sum, item) => sum + Number(item.currentPercent || 0), 0);
  const totalAccum = model.progressRows.reduce((sum, item) => sum + Number(item.accumulatedPercent || 0), 0);
  const totalRemain = model.progressRows.reduce((sum, item) => sum + Number(item.remainingPercent || 0), 0);

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1040px] overflow-hidden rounded-[24px] border-2 border-black bg-[#f8f8f3]">
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
                <div className="text-[14px] font-bold md:text-[16px]">
                  รายงานการควบคุมงานก่อสร้างประจำ{model.reportType === "MONTHLY" ? "เดือน" : "สัปดาห์"} (WEEKLY REPORT)
                </div>
                <div className="mt-1 text-[12px] font-semibold">{periodTitle}</div>
                <div className="mt-1 text-[12px]">
                  ช่วงวันที่ {formatDateBE(model.startDate)} ถึง {formatDateBE(model.endDate)}
                </div>
                <div className="mt-1 text-[12px]">โครงการ : {textOrDash(model.projectName)}</div>
              </td>
            </tr>

            <tr>
              <Cell header align="left" className="w-[19%]">สัญญาจ้าง</Cell>
              <Cell align="left" className="w-[31%]">{textOrDash(model.contractNo)}</Cell>
              <Cell header align="left" className="w-[19%]">สถานที่ก่อสร้าง</Cell>
              <Cell align="left" className="w-[31%]">{textOrDash(model.siteLocation)}</Cell>
            </tr>

            <tr>
              <Cell header align="left">งวดงาน</Cell>
              <Cell align="left">{textOrDash(model.installmentLabel)}</Cell>
              <Cell header align="left">วงเงินค่าก่อสร้าง</Cell>
              <Cell align="left">{textOrDash(model.contractValue)}</Cell>
            </tr>

            <tr>
              <Cell header align="left">เริ่มสัญญา</Cell>
              <Cell align="left">{formatDateBE(model.contractStart)}</Cell>
              <Cell header align="left">ผู้รับจ้าง</Cell>
              <Cell align="left">{textOrDash(model.contractorName)}</Cell>
            </tr>

            <tr>
              <Cell header align="left">สิ้นสุดสัญญา</Cell>
              <Cell align="left">{formatDateBE(model.contractEnd)}</Cell>
              <Cell header align="left">วิธีจัดซื้อจัดจ้าง</Cell>
              <Cell align="left">{textOrDash(model.procurementMethod)}</Cell>
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
              <Cell>{formatInteger(model.contractDays)}</Cell>
              <Cell>{formatInteger(model.previousUsedDays)}</Cell>
              <Cell>{formatInteger(model.currentPeriodDays)}</Cell>
              <Cell>{formatInteger(model.accumulatedDays)}</Cell>
              <Cell>{formatInteger(model.remainingDays)}</Cell>
              <Cell>{formatInteger(model.varianceDays)}</Cell>
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
            {model.workItems.length ? (
              model.workItems.map((item, index) => (
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
              <Cell colSpan={8} align="left" className="whitespace-pre-wrap px-3 py-3">
                {textOrDash(model.comments)}
              </Cell>
            </tr>

            <SectionTitle>ปัญหาและอุปสรรค</SectionTitle>
            <tr>
              <Cell header>ลำดับ</Cell>
              <Cell header colSpan={2}>หัวข้อ</Cell>
              <Cell header colSpan={3}>ผลกระทบ</Cell>
              <Cell header colSpan={2}>แนวทางแก้ไข</Cell>
            </tr>
            {model.problems.length ? (
              model.problems.map((item, index) => (
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
              <Cell colSpan={2}>{formatInteger(model.accidentCount ?? 0)}</Cell>
              <Cell colSpan={2}>{formatInteger(model.injuredCount ?? 0)}</Cell>
              <Cell colSpan={2}>{formatInteger(model.lostTimeCount ?? 0)}</Cell>
              <Cell colSpan={2} align="left">{textOrDash(model.safetyNote)}</Cell>
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
            {model.progressRows.length ? (
              <>
                {model.progressRows.map((item) => (
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
                <SignatureGrid items={model.supervisors} />
              </td>
            </tr>

            <tr>
              <td colSpan={8} className="border border-black bg-white px-3 py-2 text-[11px] text-black">
                <span className="font-semibold">หมายเหตุ:</span> เอกสารนี้เป็นข้อมูล{" "}
                {model.reportType === "MONTHLY" ? "Monthly Report" : "Weekly Report"} ที่ถูกสรุปจากระบบและจัดเก็บในฐานข้อมูล
              </td>
            </tr>

            <tr>
              <td colSpan={8} className="border border-black bg-white px-3 py-2 text-[11px] text-black">
                วันที่สร้างข้อมูลล่าสุด: {formatDateThai(new Date().toISOString())}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  const directModel = React.useMemo(() => buildDirectPreviewModel(model), [model]);

  if ((model.reportType === "WEEKLY" || model.reportType === "MONTHLY") && directModel) {
    return <DirectWeeklyPreview model={directModel} />;
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