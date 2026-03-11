import {
  ReportPreviewForm,
  type ReportRenderModel,
} from "@/components/ReportPreviewReadonly";
import {
  SummaryAggregatePreview,
  type SummaryDocumentModel,
} from "@/components/SummaryAggregatePreview";
import {
  getReportExportData,
  type ReportType,
} from "@/lib/pdf/generateReportPdf";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PDF_WIDTH_PX = 794;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_TOP_MM = 2;
const PAGE_MARGIN_RIGHT_MM = 10;
const PAGE_MARGIN_BOTTOM_MM = 1;
const PAGE_MARGIN_LEFT_MM = 10;

type SearchParamsShape = Promise<{
  projectId?: string;
  type?: string;
  date?: string;
  auto?: string;
}>;

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function isValidType(type: string): type is ReportType {
  return type === "daily" || type === "weekly" || type === "monthly";
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
        margin-top: ${PAGE_MARGIN_TOP_MM}mm;
        margin-right: ${PAGE_MARGIN_RIGHT_MM}mm;
        margin-bottom: ${PAGE_MARGIN_BOTTOM_MM}mm;
        margin-left: ${PAGE_MARGIN_LEFT_MM}mm;
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
        width: ${PDF_WIDTH_PX}px !important;
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
        width: ${PDF_WIDTH_PX}px !important;
        max-width: ${PDF_WIDTH_PX}px !important;
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
        break-inside: avoid-page;
        page-break-inside: avoid;
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

      [data-pdf-preview-root="1"] tr,
      [data-pdf-preview-root="1"] th,
      [data-pdf-preview-root="1"] td {
        break-inside: avoid-page;
        page-break-inside: avoid;
        page-break-after: auto;
        vertical-align: top;
      }

      [data-pdf-preview-root="1"] .pdf-page-break {
        break-before: page !important;
        page-break-before: always !important;
      }

      [data-pdf-preview-root="1"] .pdf-avoid-break,
      [data-pdf-preview-root="1"] .avoid-break,
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
    `}</style>
  );
}

function PaginationScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  var PAGE_HEIGHT_MM = ${PAGE_HEIGHT_MM};
  var PAGE_MARGIN_TOP_MM = ${PAGE_MARGIN_TOP_MM};
  var PAGE_MARGIN_BOTTOM_MM = ${PAGE_MARGIN_BOTTOM_MM};

  function mmToPx(mm) {
    return (mm / 25.4) * 96;
  }

  function topWithinRoot(el, root) {
    var r = el.getBoundingClientRect();
    var rr = root.getBoundingClientRect();
    return r.top - rr.top;
  }

  function heightOf(el) {
    var rect = el.getBoundingClientRect();
    return rect.height || 0;
  }

  function clearBreaks(root) {
    root.querySelectorAll(".pdf-page-break").forEach(function (el) {
      el.classList.remove("pdf-page-break");
    });
  }

  function markProtectedRows(root) {
    root.querySelectorAll("tr").forEach(function (row) {
      row.classList.add("pdf-avoid-break");
      row.style.breakInside = "avoid-page";
      row.style.pageBreakInside = "avoid";
    });
  }

  function markMediaBlocks(root) {
    root.querySelectorAll("img, svg, canvas").forEach(function (media) {
      var block = media.closest(".issue-card, .signature-card, figure, td, div, section, article");
      if (block && block !== root) {
        block.classList.add("pdf-media-block");
      } else {
        media.classList.add("pdf-media-block");
      }
    });
  }

  function collectCandidates(root, contentHeight) {
    var set = new Set();

    root.querySelectorAll("table").forEach(function (table) {
      var h = heightOf(table);
      if (h > 0 && h < contentHeight * 0.98) {
        set.add(table);
      }
    });

    root.querySelectorAll(".issue-card, .signature-card, .pdf-media-block").forEach(function (el) {
      var h = heightOf(el);
      if (h > 0 && h < contentHeight * 0.98) {
        set.add(el);
      }
    });

    return Array.from(set).sort(function (a, b) {
      return topWithinRoot(a, root) - topWithinRoot(b, root);
    });
  }

  function runSmartPagination() {
    var root = document.querySelector('[data-pdf-preview-root="1"]');
    if (!root) return;

    clearBreaks(root);
    markProtectedRows(root);
    markMediaBlocks(root);

    var CONTENT_HEIGHT = Math.round(
      mmToPx(PAGE_HEIGHT_MM - PAGE_MARGIN_TOP_MM - PAGE_MARGIN_BOTTOM_MM)
    );

    var TOP_GUARD = 16;
    var BOTTOM_GUARD = 8;
    var candidates = collectCandidates(root, CONTENT_HEIGHT);

    for (var pass = 0; pass < 4; pass++) {
      var changed = false;

      candidates.forEach(function (el) {
        var height = heightOf(el);
        if (!height) return;
        if (height >= CONTENT_HEIGHT * 0.98) return;

        var top = topWithinRoot(el, root);
        var offsetInPage = ((top % CONTENT_HEIGHT) + CONTENT_HEIGHT) % CONTENT_HEIGHT;
        var remaining = CONTENT_HEIGHT - offsetInPage;

        var wouldOverflow = height > (remaining - BOTTOM_GUARD);
        var alreadyAtTop = offsetInPage <= TOP_GUARD;

        if (wouldOverflow && !alreadyAtTop) {
          if (!el.classList.contains("pdf-page-break")) {
            el.classList.add("pdf-page-break");
            changed = true;
          }
        }
      });

      if (!changed) break;
    }
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
        width: `${PDF_WIDTH_PX}px`,
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
            width: `${PDF_WIDTH_PX}px`,
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
            width: `${PDF_WIDTH_PX}px`,
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
          width: `${PDF_WIDTH_PX}px`,
          margin: "0 auto",
          padding: 0,
          background: "#ffffff",
          overflow: "visible",
        }}
      >
        {result.renderMode === "daily" ? (
          <ReportPreviewForm model={result.dailyModel as ReportRenderModel} />
        ) : (
          <SummaryAggregatePreview
            model={result.summaryModel as SummaryDocumentModel}
          />
        )}
      </div>
    </main>
  );
}