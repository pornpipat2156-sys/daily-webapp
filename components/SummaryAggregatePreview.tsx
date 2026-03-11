// components/SummaryAggregatePreview.tsx
"use client";

import { useMemo, type ReactNode } from "react";

export type SummaryDocumentModel = {
  reportType: "WEEKLY" | "MONTHLY";
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

function primitiveOrDash(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่";
  return "-";
}

function compactDate(value: string) {
  const s = String(value || "").trim();
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

function titleCaseLabel(key: string) {
  const normalized = key
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
    annexNo: "ภาคผนวก",
    periodNo: "งวดงาน",
    weekNo: "สัปดาห์",
    installmentCount: "จำนวนงวด",
    totalDurationDays: "ระยะเวลาตามสัญญา",
  };

  return dictionary[key] || normalized || key;
}

function normalizeSummaryData(model: SummaryDocumentModel) {
  const payload = toRecord(model.payload) || {};
  const meta = toRecord(model.projectMeta) || {};

  const payloadHeader =
    toRecord(getByAliases(payload, ["header", "reportHeader", "documentHeader"])) || {};
  const payloadSummary =
    toRecord(getByAliases(payload, ["summary", "weeklySummary", "monthlySummary"])) || {};
  const payloadDuration =
    toRecord(getByAliases(payload, ["durationSummary", "timeSummary", "scheduleSummary"])) || {};
  const payloadSafety =
    toRecord(getByAliases(payload, ["safetySummary", "safety", "safetyStats"])) || {};
  const payloadProgress =
    toRecord(getByAliases(payload, ["progressSummary", "progress", "progressTable"])) || {};
  const payloadComment =
    toRecord(getByAliases(payload, ["commentary", "comments", "supervisorCommentSection"])) || {};

  const weekNoRaw = extractFirst(
    getByAliases(payloadHeader, ["weekNo", "week", "weekNumber"]),
    getByAliases(payload, ["weekNo", "week", "weekNumber"])
  );

  const monthRaw = extractFirst(
    getByAliases(payloadHeader, ["month", "monthNo", "monthNumber"]),
    getByAliases(payload, ["month", "monthNo", "monthNumber"])
  );

  const yearRaw = extractFirst(
    getByAliases(payloadHeader, ["year"]),
    getByAliases(payload, ["year"])
  );

  const contract = {
    contractNo: extractFirst(
      getByAliases(payloadHeader, ["contractNo", "contractNumber"]),
      getByAliases(payload, ["contractNo", "contractNumber"]),
      getByAliases(meta, ["contractNo", "contractNumber"])
    ),
    siteLocation: extractFirst(
      getByAliases(payloadHeader, ["siteLocation", "location"]),
      getByAliases(payload, ["siteLocation", "location"]),
      getByAliases(meta, ["siteLocation", "location"])
    ),
    periodNo: extractFirst(
      getByAliases(payloadHeader, ["periodNo", "periodNumber"]),
      getByAliases(payload, ["periodNo", "periodNumber"]),
      getByAliases(meta, ["periodNo", "periodNumber"])
    ),
    contractValue: extractFirst(
      getByAliases(payloadHeader, ["contractValue", "budget", "projectValue"]),
      getByAliases(payload, ["contractValue", "budget", "projectValue"]),
      getByAliases(meta, ["contractValue", "budget", "projectValue"])
    ),
    contractStart: extractFirst(
      getByAliases(payloadHeader, ["contractStart", "startDate", "start"]),
      getByAliases(payload, ["contractStart", "startDate", "start"]),
      getByAliases(meta, ["contractStart", "startDate", "start"])
    ),
    contractorName: extractFirst(
      getByAliases(payloadHeader, ["contractorName", "contractor", "vendorName"]),
      getByAliases(payload, ["contractorName", "contractor", "vendorName"]),
      getByAliases(meta, ["contractorName", "contractor", "vendorName"])
    ),
    contractEnd: extractFirst(
      getByAliases(payloadHeader, ["contractEnd", "endDate", "end"]),
      getByAliases(payload, ["contractEnd", "endDate", "end"]),
      getByAliases(meta, ["contractEnd", "endDate", "end"])
    ),
    procurementMethod: extractFirst(
      getByAliases(payloadHeader, ["procurementMethod", "purchaseMethod"]),
      getByAliases(payload, ["procurementMethod", "purchaseMethod"]),
      getByAliases(meta, ["procurementMethod", "purchaseMethod"])
    ),
  };

  const durationRow = {
    plan: extractFirst(
      getByAliases(payloadDuration, ["accordingToContract", "plan", "contractDays", "total"]),
      getByAliases(payloadSummary, ["accordingToContract", "plan", "contractDays", "total"])
    ),
    before: extractFirst(
      getByAliases(payloadDuration, ["beforeThisWeek", "before", "previous"]),
      getByAliases(payloadSummary, ["beforeThisWeek", "before", "previous"])
    ),
    thisPeriod: extractFirst(
      getByAliases(payloadDuration, ["thisWeek", "thisMonth", "thisPeriod", "current"]),
      getByAliases(payloadSummary, ["thisWeek", "thisMonth", "thisPeriod", "current"])
    ),
    cumulative: extractFirst(
      getByAliases(payloadDuration, ["cumulative", "accumulated"]),
      getByAliases(payloadSummary, ["cumulative", "accumulated"])
    ),
    remaining: extractFirst(
      getByAliases(payloadDuration, ["remaining", "balance"]),
      getByAliases(payloadSummary, ["remaining", "balance"])
    ),
    deviation: extractFirst(
      getByAliases(payloadDuration, ["deviation", "variance", "delay"]),
      getByAliases(payloadSummary, ["deviation", "variance", "delay"])
    ),
  };

  const mergedWorkItems =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payload, ["mergedWorkItems", "workItems", "works", "weeklyWorks", "monthlyWorks"])
      )
    ) || [];

  const issueRows =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payload, ["issues", "issueSummary", "obstacles", "problemItems"])
      )
    ) || [];

  const progressRows =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payloadProgress, ["items", "rows"]),
        getByAliases(payload, ["progressItems", "progressRows"])
      )
    ) || [];

  const supervisors =
    toArray<AnyRecord>(
      extractFirst(
        getByAliases(payload, ["supervisors", "approvedBy", "signers"]),
        getByAliases(meta, ["supervisors", "approvedBy", "signers"])
      )
    ) || [];

  const supervisorComment = extractFirst(
    getByAliases(payloadComment, ["text", "comment", "supervisorComment"]),
    getByAliases(payload, ["supervisorComment", "comment", "controllerComment"]),
    model.summary
  );

  const safety = {
    accident: extractFirst(
      getByAliases(payloadSafety, ["accident", "accidents", "accidentCount"]),
      getByAliases(payload, ["accident", "accidents", "accidentCount"])
    ),
    injury: extractFirst(
      getByAliases(payloadSafety, ["injury", "injuries", "injuryCount"]),
      getByAliases(payload, ["injury", "injuries", "injuryCount"])
    ),
    lostTime: extractFirst(
      getByAliases(payloadSafety, ["lostTime", "losttime"]),
      getByAliases(payload, ["lostTime", "losttime"])
    ),
    remark: extractFirst(
      getByAliases(payloadSafety, ["remark", "remarks", "note"]),
      getByAliases(payload, ["safetyRemark", "remark", "remarks"])
    ),
  };

  return {
    payload,
    meta,
    weekNo: primitiveOrDash(weekNoRaw),
    month: primitiveOrDash(monthRaw),
    year: primitiveOrDash(yearRaw),
    contract,
    durationRow,
    mergedWorkItems,
    issueRows,
    progressRows,
    supervisors,
    supervisorComment: primitiveOrDash(supervisorComment),
    safety,
  };
}

function TableCell({
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
        colSpan={12}
        className="border border-black bg-[#dfeedd] px-2 py-2 text-center text-[12px] font-bold text-black"
      >
        {children}
      </td>
    </tr>
  );
}

function valueFromRow(row: AnyRecord, aliases: string[], fallback = "-") {
  return primitiveOrDash(extractFirst(getByAliases(row, aliases), fallback));
}

function renderWorkRows(rows: AnyRecord[]) {
  if (!rows.length) {
    return (
      <tr>
        <TableCell className="font-medium" align="center">
          ไม่มีรายการงาน
        </TableCell>
        <TableCell align="center">-</TableCell>
        <TableCell align="center">-</TableCell>
        <TableCell align="center">-</TableCell>
        <TableCell align="center">-</TableCell>
        <TableCell align="center">-</TableCell>
      </tr>
    );
  }

  return rows.map((row, idx) => (
    <tr key={`work-${idx}`}>
      <TableCell>{idx + 1}</TableCell>
      <TableCell align="left">
        {valueFromRow(row, ["desc", "description", "workName", "item", "title"])}
      </TableCell>
      <TableCell align="left">
        {valueFromRow(row, ["location", "position", "area"])}
      </TableCell>
      <TableCell align="right">
        {valueFromRow(row, ["qty", "quantity", "amount"])}
      </TableCell>
      <TableCell align="center">
        {valueFromRow(row, ["unit"])}
      </TableCell>
      <TableCell align="left">
        {valueFromRow(row, ["remark", "remarks", "note", "materialDelivered"])}
      </TableCell>
    </tr>
  ));
}

function renderIssueRows(rows: AnyRecord[]) {
  if (!rows.length) {
    return (
      <tr>
        <TableCell>1</TableCell>
        <TableCell align="left">ไม่มีปัญหาและอุปสรรค</TableCell>
        <TableCell align="left">-</TableCell>
        <TableCell align="left">-</TableCell>
      </tr>
    );
  }

  return rows.map((row, idx) => (
    <tr key={`issue-${idx}`}>
      <TableCell>{idx + 1}</TableCell>
      <TableCell align="left">
        {valueFromRow(row, ["title", "topic", "problem", "detail"])}
      </TableCell>
      <TableCell align="left">
        {valueFromRow(row, ["impact", "effect", "result"])}
      </TableCell>
      <TableCell align="left">
        {valueFromRow(row, ["solution", "fix", "resolution", "action"])}
      </TableCell>
    </tr>
  ));
}

function renderProgressRows(rows: AnyRecord[]) {
  if (!rows.length) {
    return (
      <tr>
        <TableCell align="center" className="font-medium">
          ยังไม่มีการสรุปความก้าวหน้า
        </TableCell>
        <TableCell>0</TableCell>
        <TableCell>0</TableCell>
        <TableCell>0</TableCell>
        <TableCell>0</TableCell>
        <TableCell>0</TableCell>
        <TableCell>0</TableCell>
        <TableCell>-</TableCell>
      </tr>
    );
  }

  return rows.map((row, idx) => (
    <tr key={`progress-${idx}`}>
      <TableCell align="left">
        {valueFromRow(row, ["category", "name", "section", "workType", "title"], `หมวดงาน ${idx + 1}`)}
      </TableCell>
      <TableCell align="right">{valueFromRow(row, ["weight", "weightPercent", "weightPct", "weightPercentage"])}</TableCell>
      <TableCell align="right">{valueFromRow(row, ["before", "previous", "beforePercent", "previousPercent"])}</TableCell>
      <TableCell align="right">{valueFromRow(row, ["thisWeek", "thisMonth", "thisPeriod", "currentPercent"])}</TableCell>
      <TableCell align="right">{valueFromRow(row, ["cumulative", "accumulated", "cumulativePercent"])}</TableCell>
      <TableCell align="right">{valueFromRow(row, ["remaining", "balance", "remainingPercent"])}</TableCell>
      <TableCell align="right">{valueFromRow(row, ["plan", "planned", "planPercent"])}</TableCell>
      <TableCell align="right">{valueFromRow(row, ["deviation", "variance", "delay", "deviationPercent"])}</TableCell>
    </tr>
  ));
}

function SignatureGrid({ supervisors }: { supervisors: AnyRecord[] }) {
  if (!supervisors.length) {
    return (
      <div className="border border-black px-3 py-4 text-center text-[12px] text-black">
        ยังไม่มีข้อมูลผู้ลงนาม
      </div>
    );
  }

  const clean = supervisors
    .map((item) => ({
      name: str(item.name, "-"),
      role: str(item.role, ""),
    }))
    .filter((item) => item.name !== "-" || item.role);

  return (
    <div className="grid grid-cols-1 gap-3 px-2 py-3 md:grid-cols-2">
      {clean.map((item, idx) => (
        <div
          key={`sign-${idx}`}
          className="min-h-[78px] border border-black px-3 py-3 text-center text-[11px] text-black"
        >
          <div className="pt-5">ลงชื่อ ................................</div>
          <div className="mt-2">({item.name || "-"})</div>
          <div className="mt-1">{item.role || " "}</div>
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
    ([, v]) => v != null && !(Array.isArray(v) && v.length === 0) && String(v).trim() !== ""
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

  const periodSmallLabel =
    model.reportType === "WEEKLY"
      ? `สัปดาห์ที่ ${normalized.weekNo}`
      : `เดือนที่ ${normalized.month} / ${normalized.year}`;

  const hasStructuredData =
    normalized.mergedWorkItems.length > 0 ||
    normalized.issueRows.length > 0 ||
    normalized.progressRows.length > 0 ||
    normalized.supervisorComment !== "-" ||
    Object.values(normalized.contract).some((v) => v != null && String(v).trim() !== "") ||
    Object.values(normalized.durationRow).some((v) => v != null && String(v).trim() !== "");

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
                <div className="mt-1 text-[12px] font-semibold">{periodSmallLabel}</div>
                <div className="mt-1 text-[12px]">ช่วงวันที่ {str(model.periodLabel, "-")}</div>
                <div className="mt-1 text-[12px]">โครงการ : {str(model.projectName, "-")}</div>
              </td>
            </tr>

            <tr>
              <TableCell header align="left" className="w-[18%]">
                สัญญาจ้าง
              </TableCell>
              <TableCell align="left" className="w-[32%]">
                {primitiveOrDash(normalized.contract.contractNo)}
              </TableCell>
              <TableCell header align="left" className="w-[18%]">
                สถานที่ก่อสร้าง
              </TableCell>
              <TableCell align="left" className="w-[32%]">
                {primitiveOrDash(normalized.contract.siteLocation)}
              </TableCell>
            </tr>

            <tr>
              <TableCell header align="left">งวดงาน</TableCell>
              <TableCell align="left">{primitiveOrDash(normalized.contract.periodNo)}</TableCell>
              <TableCell header align="left">วงเงินค่าก่อสร้าง</TableCell>
              <TableCell align="left">{primitiveOrDash(normalized.contract.contractValue)}</TableCell>
            </tr>

            <tr>
              <TableCell header align="left">เริ่มสัญญา</TableCell>
              <TableCell align="left">{compactDate(str(normalized.contract.contractStart, "-"))}</TableCell>
              <TableCell header align="left">ผู้รับจ้าง</TableCell>
              <TableCell align="left">{primitiveOrDash(normalized.contract.contractorName)}</TableCell>
            </tr>

            <tr>
              <TableCell header align="left">สิ้นสุดสัญญา</TableCell>
              <TableCell align="left">{compactDate(str(normalized.contract.contractEnd, "-"))}</TableCell>
              <TableCell header align="left">วิธีจัดซื้อจัดจ้าง</TableCell>
              <TableCell align="left">{primitiveOrDash(normalized.contract.procurementMethod)}</TableCell>
            </tr>

            <SectionTitle>สรุประยะเวลา</SectionTitle>
            <tr>
              <TableCell header>รายการ</TableCell>
              <TableCell header>ตามสัญญา</TableCell>
              <TableCell header>ก่อนหน้านี้</TableCell>
              <TableCell header>{model.reportType === "WEEKLY" ? "สัปดาห์นี้" : "เดือนนี้"}</TableCell>
              <TableCell header>สะสม</TableCell>
              <TableCell header>คงเหลือ</TableCell>
              <TableCell header>คลาดเคลื่อน</TableCell>
            </tr>
            <tr>
              <TableCell className="font-medium">จำนวนวัน</TableCell>
              <TableCell>{primitiveOrDash(normalized.durationRow.plan)}</TableCell>
              <TableCell>{primitiveOrDash(normalized.durationRow.before)}</TableCell>
              <TableCell>{primitiveOrDash(normalized.durationRow.thisPeriod)}</TableCell>
              <TableCell>{primitiveOrDash(normalized.durationRow.cumulative)}</TableCell>
              <TableCell>{primitiveOrDash(normalized.durationRow.remaining)}</TableCell>
              <TableCell>{primitiveOrDash(normalized.durationRow.deviation)}</TableCell>
            </tr>

            <SectionTitle>
              ผลงานที่ดำเนินการประจำ{model.reportType === "WEEKLY" ? "สัปดาห์" : "เดือน"}
            </SectionTitle>
            <tr>
              <TableCell header>ลำดับ</TableCell>
              <TableCell header>รายการงาน</TableCell>
              <TableCell header>ตำแหน่ง</TableCell>
              <TableCell header>ปริมาณ</TableCell>
              <TableCell header>หน่วย</TableCell>
              <TableCell header>หมายเหตุ</TableCell>
            </tr>
            {renderWorkRows(normalized.mergedWorkItems)}

            <SectionTitle>ความคิดเห็นเห็นผู้ควบคุมงาน</SectionTitle>
            <tr>
              <TableCell colSpan={6} align="left" className="px-3 py-3">
                {normalized.supervisorComment}
              </TableCell>
            </tr>

            <SectionTitle>ปัญหาและอุปสรรค</SectionTitle>
            <tr>
              <TableCell header>ลำดับ</TableCell>
              <TableCell header>หัวข้อ</TableCell>
              <TableCell header>ผลกระทบ</TableCell>
              <TableCell header>แนวทางแก้ไข</TableCell>
            </tr>
            {renderIssueRows(normalized.issueRows)}

            <SectionTitle>ความปลอดภัยในการทำงาน</SectionTitle>
            <tr>
              <TableCell header>อุบัติเหตุ</TableCell>
              <TableCell header>บาดเจ็บ</TableCell>
              <TableCell header>Lost Time</TableCell>
              <TableCell header>หมายเหตุ</TableCell>
            </tr>
            <tr>
              <TableCell>{primitiveOrDash(normalized.safety.accident)}</TableCell>
              <TableCell>{primitiveOrDash(normalized.safety.injury)}</TableCell>
              <TableCell>{primitiveOrDash(normalized.safety.lostTime)}</TableCell>
              <TableCell align="left">{primitiveOrDash(normalized.safety.remark)}</TableCell>
            </tr>

            <SectionTitle>สรุปความก้าวหน้า</SectionTitle>
            <tr>
              <TableCell header>หมวดงาน</TableCell>
              <TableCell header>น้ำหนัก (%)</TableCell>
              <TableCell header>ก่อนหน้า (%)</TableCell>
              <TableCell header>{model.reportType === "WEEKLY" ? "สัปดาห์นี้ (%)" : "เดือนนี้ (%)"}</TableCell>
              <TableCell header>สะสม (%)</TableCell>
              <TableCell header>คงเหลือ (%)</TableCell>
              <TableCell header>แผน (%)</TableCell>
              <TableCell header>คลาดเคลื่อน (%)</TableCell>
            </tr>
            {renderProgressRows(normalized.progressRows)}

            <SectionTitle>ผู้ควบคุมงาน / ผู้ลงนาม</SectionTitle>
            <tr>
              <td colSpan={8} className="border border-black bg-white p-0">
                <SignatureGrid supervisors={normalized.supervisors} />
              </td>
            </tr>

            <tr>
              <td colSpan={8} className="border border-black bg-white px-3 py-2 text-[11px] text-black">
                <span className="font-semibold">หมายเหตุ:</span> เอกสารนี้เป็นข้อมูล{" "}
                {model.reportType === "WEEKLY" ? "Weekly Report" : "Monthly Report"} ที่ถูกสรุปจากระบบและจัดเก็บในฐานข้อมูล
              </td>
            </tr>

            <tr>
              <td colSpan={8} className="border border-black bg-white px-3 py-2 text-[11px] text-black">
                วันที่สร้างข้อมูลล่าสุด: {compactDate(model.selectedDate)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!printMode && !hasStructuredData ? (
        <MetaFallback
          projectMeta={normalized.meta}
          payload={normalized.payload}
        />
      ) : null}
    </div>
  );
}