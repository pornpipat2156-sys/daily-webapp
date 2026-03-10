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
        margin-top: 2mm;
        margin-right: 10mm;
        margin-bottom: 5mm;
        margin-left: 10mm;
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
        width: 794px !important;
        margin: 0 auto !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: visible !important;
        font-family: "Noto Sans Thai", Arial, sans-serif !important;
      }

      [data-pdf-preview-root="1"] * {
        font-family: "Noto Sans Thai", Arial, sans-serif !important;
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
      [data-pdf-preview-root="1"] .signature-card {
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
  function runSmartPagination() {
    var root = document.querySelector('[data-pdf-preview-root="1"]');
    if (!root) return;

    root.querySelectorAll('.pdf-page-break').forEach(function (el) {
      el.classList.remove('pdf-page-break');
    });

    var PX_PER_INCH = 96;
    var A4_HEIGHT_PX = Math.round(11.6929 * PX_PER_INCH); // ~1122.5
    var TOP_MARGIN_PX = Math.round(1.5 * PX_PER_INCH);    // 144
    var OTHER_MARGIN_PX = Math.round((10 / 25.4) * PX_PER_INCH); // ~38
    var CONTENT_HEIGHT = A4_HEIGHT_PX - TOP_MARGIN_PX - OTHER_MARGIN_PX;

    function topWithinRoot(el) {
      var r = el.getBoundingClientRect();
      var rr = root.getBoundingClientRect();
      return r.top - rr.top;
    }

    function shouldAvoidBreak(el) {
      var text = (el.textContent || "").trim();
      if (!text) return false;

      return (
        text.includes("รายละเอียดของงานที่ได้ดำเนินงานทำแล้ว") ||
        text.includes("WORK PERFORMED") ||
        text.includes("บันทึกด้านความปลอดภัยในการทำงาน") ||
        text.includes("รายชื่อผู้ควบคุมงาน") ||
        text.includes("PROJECT TEAM") ||
        text.includes("ปัญหา") ||
        text.includes("อุปสรรค") ||
        text.includes("Issues") ||
        text.includes("Obstacles")
      );
    }

    function pickBlock(el) {
      var current = el;
      while (current && current !== root) {
        if (
          current.tagName === "TABLE" ||
          current.classList.contains("pdf-avoid-break") ||
          current.classList.contains("avoid-break")
        ) {
          return current;
        }

        var style = window.getComputedStyle(current);
        var hasBorder =
          parseFloat(style.borderTopWidth || "0") > 0 ||
          parseFloat(style.borderRightWidth || "0") > 0 ||
          parseFloat(style.borderBottomWidth || "0") > 0 ||
          parseFloat(style.borderLeftWidth || "0") > 0;

        if (hasBorder || style.borderRadius !== "0px") {
          return current;
        }

        current = current.parentElement;
      }
      return el;
    }

    root.querySelectorAll("tr").forEach(function (row) {
      row.classList.add("pdf-avoid-break");
      row.style.breakInside = "avoid-page";
      row.style.pageBreakInside = "avoid";
    });

    var candidateSet = new Set();

    root.querySelectorAll("table").forEach(function (el) {
      candidateSet.add(el);
    });

    root.querySelectorAll("div, section, article").forEach(function (el) {
      if (shouldAvoidBreak(el)) {
        candidateSet.add(pickBlock(el));
      }
    });

    var candidates = Array.from(candidateSet)
      .filter(function (el) {
        return el && el !== root && typeof el.getBoundingClientRect === "function";
      })
      .sort(function (a, b) {
        return topWithinRoot(a) - topWithinRoot(b);
      });

    for (var pass = 0; pass < 3; pass++) {
      var changed = false;

      candidates.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var height = rect.height;
        if (!height) return;

        var top = topWithinRoot(el);
        var offsetInPage = ((top % CONTENT_HEIGHT) + CONTENT_HEIGHT) % CONTENT_HEIGHT;
        var remaining = CONTENT_HEIGHT - offsetInPage;

        if (height > remaining && offsetInPage > 24 && height < CONTENT_HEIGHT * 0.95) {
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
    setTimeout(runSmartPagination, 300);
    setTimeout(runSmartPagination, 900);
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
        width: "794px",
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
            width: "794px",
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
            width: "794px",
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
          width: "794px",
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