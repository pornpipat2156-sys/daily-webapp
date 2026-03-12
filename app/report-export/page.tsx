import {
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

import ExportDailyPreviewClient from "./ExportDailyPreviewClient";

import {
  getReportExportData,
  type ReportType,
} from "@/lib/pdf/generateReportPdf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PDF_PAGE_WIDTH_PX = 794;

type SearchParamsShape = Promise<{
  projectId?: string;
  type?: string;
  date?: string;
}>;

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

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function isValidType(type: string): type is ReportType {
  return type === "daily" || type === "weekly" || type === "monthly";
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toText(value: unknown, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function buildWeeklyModelFromSummary(
  result: SummaryResponse
): WeeklyReportModel | null {
  if (result.reportType !== "WEEKLY") return null;

  const model = (result.summaryModel ?? {}) as Record<string, unknown>;

  const payload = toRecord(model.payload) ?? {};
  const projectMeta =
    toRecord(payload.projectMeta) ??
    toRecord(model.projectMeta) ??
    {};

  const workSource = toArray<Record<string, unknown>>(payload.mergedWorkItems);
  const issueSource = toArray<unknown>(payload.normalizedIssues);

  const normalizedWork: WeeklyWorkItem[] = workSource.map((item, index) => ({
    id: String(item.id ?? `work-${index + 1}`),
    description: toText(item.desc, "-"),
    location: toText(item.location, ""),
    qty:
      item.qtyTotal == null || String(item.qtyTotal).trim() === ""
        ? null
        : toNumber(item.qtyTotal, 0),
    unit: toText(item.unit, ""),
    remark: toText(item.materialDelivered, ""),
  }));

  const normalizedProblems: WeeklyProblemItem[] = issueSource.map(
    (item, index) => ({
      id: `problem-${index + 1}`,
      topic: toText(item, "-"),
      impact: "",
      solution: "",
    })
  );

  const payloadDateStart = toText(payload.dateStart, "");
  const payloadDateEnd = toText(payload.dateEnd, "");

  const yearFromDate =
    payloadDateStart && !Number.isNaN(new Date(payloadDateStart).getTime())
      ? new Date(payloadDateStart).getFullYear()
      : new Date(result.selectedDate).getFullYear();

  return {
    id: result.reportId,
    projectId: result.projectId,
    year: toNumber(payload.year, yearFromDate),
    weekNo: toNumber(payload.weekNo, 0),
    startDate: payloadDateStart || result.selectedDate,
    endDate: payloadDateEnd || result.selectedDate,
    title: result.documentTitle,

    summary: {
      projectName: toText(projectMeta.projectName, result.projectName),
      contractNo: toText(projectMeta.contractNo, "-"),
      installmentLabel: toText(projectMeta.periodNo, "-"),
      contractorName: toText(projectMeta.contractorName, "-"),
      siteLocation: toText(projectMeta.siteLocation, "-"),
      contractStart: toText(projectMeta.contractStart, "-"),
      contractEnd: toText(projectMeta.contractEnd, "-"),
      contractValue: toText(projectMeta.contractValue, "-"),
      procurementMethod: toText(projectMeta.procurementMethod, "-"),
      periodNo: toText(projectMeta.periodNo, ""),
    },

    timeSummary: {
      contractDays: 0,
      previousUsedDays: 0,
      currentWeekDays: 0,
      accumulatedDays: 0,
      remainingDays: 0,
      plannedDays: null,
      varianceDays: null,
    } satisfies WeeklyTimeSummary,

    workPerformedWeekly: normalizedWork,

    comments: toText(model.summary, "-"),

    problemsAndObstacles: normalizedProblems,

    safety: {
      note: "-",
      accidentCount: 0,
      injuredCount: 0,
      lostTimeCount: 0,
    },

    progressByCategory: [] as WeeklyProgressItem[],
    supervisors: [] as WeeklySupervisor[],

    createdAt: "",
    updatedAt: "",
  };
}

export default async function ReportExportPage({
  searchParams,
}: {
  searchParams: SearchParamsShape;
}) {
  const params = await searchParams;

  const projectId = str(params?.projectId);
  const type = str(params?.type).toLowerCase();
  const date = str(params?.date);

  if (!projectId || !date || !isValidType(type)) {
    return <div>ข้อมูลสำหรับสร้าง PDF ไม่ถูกต้อง</div>;
  }

  const result = await getReportExportData({
    projectId,
    type,
    date,
  });

  if (!result.found) {
    return <div>{result.message || "ไม่พบรายงาน"}</div>;
  }

  const weeklyPreviewModel =
    result.renderMode === "summary" && result.reportType === "WEEKLY"
      ? buildWeeklyModelFromSummary(result as SummaryResponse)
      : null;

  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        background: "#ffffff",
      }}
    >
      <div
        data-pdf-preview-root="1"
        style={{
          width: `${PDF_PAGE_WIDTH_PX}px`,
          margin: "0 auto",
          padding: 0,
          background: "#ffffff",
        }}
      >
        {result.renderMode === "daily" ? (
          <ExportDailyPreviewClient
            model={result.dailyModel as ReportRenderModel}
          />
        ) : result.reportType === "WEEKLY" && weeklyPreviewModel ? (
          <WeeklyReportForm model={weeklyPreviewModel} />
        ) : (
          <SummaryAggregatePreview
            model={result.summaryModel as SummaryDocumentModel}
          />
        )}
      </div>
    </main>
  );
}