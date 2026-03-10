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
}>;

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function isValidType(type: string): type is ReportType {
  return type === "daily" || type === "weekly" || type === "monthly";
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        width: "794px",
        margin: "0 auto",
        background: "#ffffff",
        color: "#111827",
        padding: 0,
        fontFamily: "Arial, sans-serif",
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

export default async function ReportExportPreviewPage({
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
        <div
          data-pdf-preview-root="1"
          style={{
            width: "794px",
            margin: "0 auto",
            padding: 0,
            background: "#ffffff",
          }}
        >
          <ErrorBox message="ข้อมูลสำหรับสร้าง PDF ไม่ถูกต้อง" />
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
        <style>{`
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        `}</style>

        <div
          data-pdf-preview-root="1"
          style={{
            width: "794px",
            margin: "0 auto",
            padding: 0,
            background: "#ffffff",
          }}
        >
          <ErrorBox message={result.message || "ไม่พบรายงาน"} />
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
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
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
        button {
          display: none !important;
          visibility: hidden !important;
        }
      `}</style>

      <div
        data-pdf-preview-root="1"
        style={{
          width: "794px",
          margin: "0 auto",
          padding: 0,
          background: "#ffffff",
          overflow: "hidden",
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