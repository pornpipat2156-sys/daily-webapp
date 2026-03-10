import { NextRequest, NextResponse } from "next/server";
import {
  buildReportPdf,
  getReportExportData,
  type ReportType,
} from "@/lib/pdf/generateReportPdf";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function toAsciiFileName(value: string) {
  const cleaned = sanitizeFileName(value);
  const asciiOnly = cleaned
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return asciiOnly || "report.pdf";
}

function buildFileName(
  projectName: string,
  reportType: "DAILY" | "WEEKLY" | "MONTHLY"
) {
  const safeProject = sanitizeFileName(projectName || "Project");

  if (reportType === "DAILY") return `${safeProject}-DailyReport.pdf`;
  if (reportType === "WEEKLY") return `${safeProject}-WeeklyReport.pdf`;
  return `${safeProject}-MonthlyReport.pdf`;
}

function buildPreviewUrl(req: NextRequest, params: URLSearchParams) {
  const origin = req.nextUrl.origin;
  return `${origin}/report-export-preview?${params.toString()}`;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "forbidden" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => null);

    const projectId = str(body?.projectId);
    const type = str(body?.type).toLowerCase() as ReportType;
    const date = str(body?.date);

    if (!projectId) {
      return NextResponse.json(
        { ok: false, message: "missing projectId" },
        { status: 400 }
      );
    }

    if (!["daily", "weekly", "monthly"].includes(type)) {
      return NextResponse.json(
        { ok: false, message: "invalid type" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { ok: false, message: "missing date" },
        { status: 400 }
      );
    }

    const result = await getReportExportData({
      projectId,
      type,
      date,
    });

    if (!result.found) {
      return NextResponse.json(
        { ok: false, message: result.message || "ไม่พบรายงาน" },
        { status: 404 }
      );
    }

    const params = new URLSearchParams({
      projectId,
      type,
      date,
    });

    const previewUrl = buildPreviewUrl(req, params);
    const cookieHeader = req.headers.get("cookie") || "";

    const pdfBuffer = await buildReportPdf({
      previewUrl,
      cookieHeader,
    });

    const pdfBytes = new Uint8Array(pdfBuffer);
    const unicodeFileName = buildFileName(result.projectName, result.reportType);
    const asciiFileName = toAsciiFileName(unicodeFileName);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(
          unicodeFileName
        )}`,
        "Cache-Control": "no-store, max-age=0",
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}