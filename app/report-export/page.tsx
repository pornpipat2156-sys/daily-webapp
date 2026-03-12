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
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_MARGIN_TOP_MM = 2;
const PDF_MARGIN_RIGHT_MM = 10;
const PDF_MARGIN_BOTTOM_MM = 1;
const PDF_MARGIN_LEFT_MM = 10;

type SearchParamsShape = Promise<{
  projectId?: string;
  type?: string;
  date?: string;
  auto?: string;
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

function buildWeeklyModelFromSummaryForExport(
  result: SummaryResponse
): WeeklyReportModel | null {
  if (result.reportType !== "WEEKLY") return null;

  const model = (result.summaryModel ?? {}) as Record<string, unknown>;

  const payload = toRecord(model.payload) ?? {};

const modelProjectMeta = toRecord(model.projectMeta) ?? {};
const payloadProjectMeta = toRecord(payload.projectMeta) ?? {};

const projectMeta = {
  ...modelProjectMeta,
  ...payloadProjectMeta,
};

  const timeSummary = toRecord(payload.timeSummary) ?? {};
  const safety = toRecord(payload.safety) ?? {};

  const workSource = toArray<Record<string, unknown>>(payload.mergedWorkItems);
  const problemSource = toArray<unknown>(payload.normalizedIssues);
  const progressSource = toArray<Record<string, unknown>>(payload.progressByCategory);
  const supervisorSource = toArray<Record<string, unknown>>(payload.supervisors);

const projectSupervisorSource = toArray<Record<string, unknown>>(
  payloadProjectMeta.supervisors ?? modelProjectMeta.supervisors
);

const normalizedSupervisors: WeeklySupervisor[] = (
  supervisorSource.length > 0 ? supervisorSource : projectSupervisorSource
)
  .map((item) => ({
    name: toText(item.name, ""),
    role: toText(item.role, "ผู้ควบคุมงาน"),
  }))
  .filter((item) => item.name || item.role);

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

  const normalizedProblems: WeeklyProblemItem[] = problemSource.map((item, index) => ({
    id: `problem-${index + 1}`,
    topic: toText(item, "-"),
    impact: "",
    solution: "",
  }));

  const normalizedProgress: WeeklyProgressItem[] = progressSource.map((item, index) => ({
    id: String(item.id ?? `progress-${index + 1}`),
    category: toText(item.category, `หมวดงาน ${index + 1}`),
    weightPercent: toNumber(item.weightPercent, 0),
    previousPercent: toNumber(item.previousPercent, 0),
    weeklyPercent: toNumber(item.weeklyPercent, 0),
    accumulatedPercent: toNumber(item.accumulatedPercent, 0),
    remainingPercent: toNumber(item.remainingPercent, 0),
    plannedPercent:
      item.plannedPercent == null || String(item.plannedPercent).trim() === ""
        ? null
        : toNumber(item.plannedPercent, 0),
    variancePercent:
      item.variancePercent == null || String(item.variancePercent).trim() === ""
        ? null
        : toNumber(item.variancePercent, 0),
    amountTotal:
      item.amountTotal == null || String(item.amountTotal).trim() === ""
        ? null
        : toNumber(item.amountTotal, 0),
    amountAccumulated:
      item.amountAccumulated == null || String(item.amountAccumulated).trim() === ""
        ? null
        : toNumber(item.amountAccumulated, 0),
    amountRemaining:
      item.amountRemaining == null || String(item.amountRemaining).trim() === ""
        ? null
        : toNumber(item.amountRemaining, 0),
  }));

  const payloadDateStart = toText(payload.dateStart, "");
  const payloadDateEnd = toText(payload.dateEnd, "");
  const yearFromDate =
    payloadDateStart && !Number.isNaN(new Date(payloadDateStart).getTime())
      ? new Date(payloadDateStart).getFullYear()
      : new Date(result.selectedDate).getFullYear();

  // DIRECT WEEKLY EXPORT BUILD
  return {
    id: result.reportId,
    projectId: result.projectId,
    year: toNumber(payload.year, yearFromDate),
    weekNo: toNumber(payload.weekNo, 0),
    startDate: payloadDateStart || result.selectedDate,
    endDate: payloadDateEnd || result.selectedDate,
    title: toText(
      (model.title as string | null) ??
        (model.documentTitle as string | null) ??
        result.documentTitle,
      result.documentTitle
    ),
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
      contractDays: toNumber(timeSummary.contractDays, 0),
      previousUsedDays: toNumber(timeSummary.previousUsedDays, 0),
      currentWeekDays: toNumber(timeSummary.currentWeekDays, 0),
      accumulatedDays: toNumber(timeSummary.accumulatedDays, 0),
      remainingDays: toNumber(timeSummary.remainingDays, 0),
      plannedDays:
        timeSummary.plannedDays == null || String(timeSummary.plannedDays).trim() === ""
          ? null
          : toNumber(timeSummary.plannedDays, 0),
      varianceDays:
        timeSummary.varianceDays == null || String(timeSummary.varianceDays).trim() === ""
          ? null
          : toNumber(timeSummary.varianceDays, 0),
    } satisfies WeeklyTimeSummary,
    workPerformedWeekly: normalizedWork,
    comments: toText(model.summary, "-"),
    problemsAndObstacles: normalizedProblems,
    safety: {
      note: toText(safety.note, "-"),
      accidentCount: toNumber(safety.accidentCount, 0),
      injuredCount: toNumber(safety.injuredCount, 0),
      lostTimeCount: toNumber(safety.lostTimeCount, 0),
    },
    progressByCategory: normalizedProgress,
    supervisors: normalizedSupervisors,
    createdAt: toText(payload.createdAt ?? model.createdAt, ""),
    updatedAt: toText(payload.updatedAt ?? model.updatedAt, ""),
  };
}

function ExportGlobalStyle() {
  return (
    <style>{`
      @import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700;800&display=swap");

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        font-family: "Noto Sans Thai", Arial, sans-serif !important;
      }

      @page {
        size: A4 portrait;
        margin-top: ${PDF_MARGIN_TOP_MM}mm;
        margin-right: ${PDF_MARGIN_RIGHT_MM}mm;
        margin-bottom: ${PDF_MARGIN_BOTTOM_MM}mm;
        margin-left: ${PDF_MARGIN_LEFT_MM}mm;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        font-family: "Noto Sans Thai", Arial, sans-serif !important;
        box-sizing: border-box;
      }

      header,
      nav,
      aside,
      footer,
      nextjs-portal,
      #__next-build-watcher,
      [data-nextjs-toast],
      [data-next-badge-root],
      [data-next-mark],
      [data-next-route-announcer],
      [aria-label="Open Next.js Dev Tools"],
      [data-vercel-toolbar],
      iframe,
      button,
      .export-print-btn {
        display: none !important;
        visibility: hidden !important;
      }

      [data-pdf-preview-root="1"] {
        width: ${PDF_PAGE_WIDTH_PX}px !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: visible !important;
        font-family: "Noto Sans Thai", Arial, sans-serif !important;
      }

      [data-pdf-preview-root="1"] * {
        font-family: "Noto Sans Thai", Arial, sans-serif !important;
      }

      [data-pdf-preview-root="1"] [style*="transform: scale("] {
        transform: none !important;
        transform-origin: top left !important;
      }

      [data-pdf-preview-root="1"] [style*="scale("] {
        transform: none !important;
      }

      [data-pdf-preview-root="1"] [style*="height: calc("],
      [data-pdf-preview-root="1"] [style*="height:calc("] {
        height: auto !important;
        min-height: 0 !important;
      }

      [data-pdf-preview-root="1"] [style*="width: 794px"],
      [data-pdf-preview-root="1"] [style*="width:794px"] {
        width: ${PDF_PAGE_WIDTH_PX}px !important;
        max-width: ${PDF_PAGE_WIDTH_PX}px !important;
      }

      img,
      svg,
      canvas {
        max-width: 100%;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }

      [data-pdf-preview-root="1"] table {
        width: 100%;
        border-collapse: collapse;
        break-inside: auto;
        page-break-inside: auto;
      }

      [data-pdf-preview-root="1"] thead {
        display: table-header-group;
      }

      [data-pdf-preview-root="1"] tfoot {
        display: table-footer-group;
      }

      [data-pdf-preview-root="1"] tbody {
        break-inside: auto;
        page-break-inside: auto;
      }

      [data-pdf-preview-root="1"] tr {
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
        page-break-after: auto !important;
      }

      [data-pdf-preview-root="1"] th,
      [data-pdf-preview-root="1"] td {
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
        vertical-align: top;
      }

      [data-pdf-preview-root="1"] .pdf-page-break {
        break-before: page !important;
        page-break-before: always !important;
      }

      [data-pdf-preview-root="1"] .pdf-keep-block,
      [data-pdf-preview-root="1"] .issue-card,
      [data-pdf-preview-root="1"] .signature-card,
      [data-pdf-preview-root="1"] .pdf-media-block {
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
      }

      [data-pdf-preview-root="1"] h1,
      [data-pdf-preview-root="1"] h2,
      [data-pdf-preview-root="1"] h3,
      [data-pdf-preview-root="1"] h4,
      [data-pdf-preview-root="1"] h5,
      [data-pdf-preview-root="1"] h6 {
        break-after: avoid-page;
        page-break-after: avoid;
      }

      [data-pdf-preview-root="1"] td,
      [data-pdf-preview-root="1"] th,
      [data-pdf-preview-root="1"] p,
      [data-pdf-preview-root="1"] span,
      [data-pdf-preview-root="1"] div {
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      [data-pdf-preview-root="1"] p,
      [data-pdf-preview-root="1"] li {
        orphans: 3;
        widows: 3;
      }

      /* WEEKLY EXPORT FIX: allow bottom content to flow across printed pages */
      [data-weekly-export-print-root="1"] {
        width: ${PDF_PAGE_WIDTH_PX}px !important;
        overflow: visible !important;
        max-height: none !important;
        height: auto !important;
        min-height: 0 !important;
      }

      [data-weekly-export-print-root="1"] * {
        overflow: visible !important;
      }

      @media print {
        [data-weekly-export-print-root="1"] {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
          min-height: 0 !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        [data-weekly-export-print-root="1"] > div,
        [data-weekly-export-print-root="1"] > section,
        [data-weekly-export-print-root="1"] > article {
          overflow: visible !important;
          max-height: none !important;
          height: auto !important;
          min-height: 0 !important;
        }

        [data-weekly-export-print-root="1"] [style*="overflow: hidden"] {
          overflow: visible !important;
        }

        [data-weekly-export-print-root="1"] [style*="max-height"] {
          max-height: none !important;
        }

        [data-weekly-export-print-root="1"] [style*="min-height"] {
          min-height: 0 !important;
        }

        [data-weekly-export-print-root="1"] [style*="height:"] {
          height: auto !important;
        }

        [data-weekly-export-print-root="1"] [style*="transform: scale("] {
          transform: none !important;
          transform-origin: top left !important;
        }

        [data-weekly-export-print-root="1"] table,
        [data-weekly-export-print-root="1"] tbody,
        [data-weekly-export-print-root="1"] tr,
        [data-weekly-export-print-root="1"] td,
        [data-weekly-export-print-root="1"] th {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `}</style>
  );
}

function PaginationScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  var PAGE_HEIGHT_MM = ${PDF_PAGE_HEIGHT_MM};
  var PAGE_MARGIN_TOP_MM = ${PDF_MARGIN_TOP_MM};
  var PAGE_MARGIN_BOTTOM_MM = ${PDF_MARGIN_BOTTOM_MM};

  function mmToPx(mm) {
    return (mm / 25.4) * 96;
  }

  function getRoot() {
    return document.querySelector('[data-pdf-preview-root="1"]');
  }

  function topWithinRoot(el, root) {
    var rect = el.getBoundingClientRect();
    var rootRect = root.getBoundingClientRect();
    return rect.top - rootRect.top;
  }

  function heightOf(el) {
    return el.getBoundingClientRect().height || 0;
  }

  function contentHeightPx() {
    return Math.round(mmToPx(PAGE_HEIGHT_MM - PAGE_MARGIN_TOP_MM - PAGE_MARGIN_BOTTOM_MM));
  }

  function clearDynamicClasses(root) {
    root.querySelectorAll(".pdf-page-break").forEach(function (el) {
      el.classList.remove("pdf-page-break");
    });

    root.querySelectorAll(".pdf-keep-block").forEach(function (el) {
      el.classList.remove("pdf-keep-block");
    });

    root.querySelectorAll(".pdf-media-block").forEach(function (el) {
      el.classList.remove("pdf-media-block");
    });
  }

  function markMediaBlocks(root) {
    root.querySelectorAll("img, svg, canvas").forEach(function (media) {
      var block =
        media.closest(".issue-card, .signature-card, figure, td, div") || media;

      if (block && block !== root) {
        block.classList.add("pdf-media-block");
      }
    });
  }

  function offsetInPage(top, pageContentHeight) {
    return ((top % pageContentHeight) + pageContentHeight) % pageContentHeight;
  }

  function maybeBreakWholeBlock(el, root, pageContentHeight) {
    var TOP_GUARD = 12;
    var BOTTOM_GUARD = 8;

    var h = heightOf(el);
    if (!h) return;
    if (h >= pageContentHeight * 0.98) return;

    var top = topWithinRoot(el, root);
    var offset = offsetInPage(top, pageContentHeight);
    var remaining = pageContentHeight - offset;

    var wouldOverflow = h > (remaining - BOTTOM_GUARD);
    var alreadyAtTop = offset <= TOP_GUARD;

    if (wouldOverflow && !alreadyAtTop) {
      el.classList.add("pdf-page-break");
    }
  }

  function markShortTablesAsWholeBlocks(root, pageContentHeight) {
    root.querySelectorAll("table").forEach(function (table) {
      var rows = Array.from(table.querySelectorAll("tr"));
      var tableHeight = heightOf(table);

      if (!rows.length || !tableHeight) return;

      if (rows.length <= 6 && tableHeight < pageContentHeight * 0.92) {
        table.classList.add("pdf-keep-block");
      }
    });
  }

  function breakWholeBlocks(root, pageContentHeight) {
    var blocks = Array.from(
      root.querySelectorAll("table.pdf-keep-block, .issue-card, .signature-card, .pdf-media-block")
    ).sort(function (a, b) {
      return topWithinRoot(a, root) - topWithinRoot(b, root);
    });

    blocks.forEach(function (el) {
      maybeBreakWholeBlock(el, root, pageContentHeight);
    });
  }

  function breakLongTablesByRow(root, pageContentHeight) {
    var TOP_GUARD = 12;
    var BOTTOM_GUARD = 8;

    root.querySelectorAll("table").forEach(function (table) {
      if (table.classList.contains("pdf-keep-block")) return;

      var rows = Array.from(table.querySelectorAll("tr"));
      var tableHeight = heightOf(table);

      if (!rows.length || !tableHeight) return;
      if (tableHeight < pageContentHeight * 0.55) return;

      rows.forEach(function (row, index) {
        if (index === 0) return;

        var rowHeight = heightOf(row);
        if (!rowHeight) return;
        if (rowHeight >= pageContentHeight * 0.98) return;

        var top = topWithinRoot(row, root);
        var offset = offsetInPage(top, pageContentHeight);
        var remaining = pageContentHeight - offset;

        var wouldOverflow = rowHeight > (remaining - BOTTOM_GUARD);
        var alreadyAtTop = offset <= TOP_GUARD;

        if (wouldOverflow && !alreadyAtTop) {
          row.classList.add("pdf-page-break");
        }
      });
    });
  }

  function runSmartPagination() {
    var root = getRoot();
    if (!root) return;

    clearDynamicClasses(root);
    markMediaBlocks(root);

    var pageContentHeight = contentHeightPx();

    markShortTablesAsWholeBlocks(root, pageContentHeight);
    breakWholeBlocks(root, pageContentHeight);
    breakLongTablesByRow(root, pageContentHeight);
  }

  function boot() {
    runSmartPagination();
    setTimeout(runSmartPagination, 250);
    setTimeout(runSmartPagination, 700);
    setTimeout(runSmartPagination, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("load", boot);
})();
        `,
      }}
    />
  );
}

function MessageBox({ message }: { message: string }) {
  return (
    <div
      style={{
        width: `${PDF_PAGE_WIDTH_PX}px`,
        margin: "0 auto",
        background: "#ffffff",
        color: "#111827",
        padding: 0,
        fontFamily: '"Noto Sans Thai", Arial, sans-serif',
        fontSize: "14px",
      }}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "24px",
          margin: "16px",
        }}
      >
        {message}
      </div>
    </div>
  );
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
    return (
      <main
        style={{
          margin: 0,
          padding: 0,
          background: "#ffffff",
        }}
      >
        <ExportGlobalStyle />
        <PaginationScript />

        <div
          data-pdf-preview-root="1"
          style={{
            width: `${PDF_PAGE_WIDTH_PX}px`,
            margin: "0 auto",
            padding: 0,
            background: "#ffffff",
            overflow: "visible",
          }}
        >
          <MessageBox message="ข้อมูลสำหรับสร้าง PDF ไม่ถูกต้อง" />
        </div>
      </main>
    );
  }

  const result = await getReportExportData({
    projectId,
    type,
    date,
  });

  if (!result.found) {
    return (
      <main
        style={{
          margin: 0,
          padding: 0,
          background: "#ffffff",
        }}
      >
        <ExportGlobalStyle />
        <PaginationScript />

        <div
          data-pdf-preview-root="1"
          style={{
            width: `${PDF_PAGE_WIDTH_PX}px`,
            margin: "0 auto",
            padding: 0,
            background: "#ffffff",
            overflow: "visible",
          }}
        >
          <MessageBox message={result.message || "ไม่พบรายงาน"} />
        </div>
      </main>
    );
  }

  const weeklyExportModel =
    result.renderMode === "summary" && result.reportType === "WEEKLY"
      ? buildWeeklyModelFromSummaryForExport(result as SummaryResponse)
      : null;

  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        background: "#ffffff",
      }}
    >
      <ExportGlobalStyle />
      <PaginationScript />

      <div
        data-pdf-preview-root="1"
        style={{
          width: `${PDF_PAGE_WIDTH_PX}px`,
          margin: "0 auto",
          padding: 0,
          background: "#ffffff",
          overflow: "visible",
        }}
      >
        {result.renderMode === "daily" ? (
          <ExportDailyPreviewClient
            model={result.dailyModel as ReportRenderModel}
          />
        ) : result.reportType === "WEEKLY" && weeklyExportModel ? (
          <div className="weekly-export-print-root" data-weekly-export-print-root="1">
            <WeeklyReportForm
              model={weeklyExportModel}
              loading={false}
              error={undefined}
            />
          </div>
        ) : (
          <SummaryAggregatePreview
            model={result.summaryModel as SummaryDocumentModel}
          />
        )}
      </div>
    </main>
  );
}