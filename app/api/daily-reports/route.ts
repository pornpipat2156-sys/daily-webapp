// app/api/daily-reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IssueRow = { detail: string; imageDataUrl?: string };

function toDateOnly(dateStr: string) {
  const d = new Date(dateStr); // yyyy-mm-dd -> Date
  if (Number.isNaN(d.getTime())) return null;
  // normalize เป็น 00:00:00 (กัน timezone เพี้ยนแบบง่าย)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = String(url.searchParams.get("projectId") || "").trim();
  if (!projectId) return NextResponse.json({ ok: false, message: "missing projectId" }, { status: 400 });

  try {
    const rows = await prisma.dailyReport.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      select: { id: true, date: true },
      take: 60,
    });

    return NextResponse.json({
      ok: true,
      reports: rows.map((r) => ({ id: r.id, date: r.date.toISOString() })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const projectId = String(body?.projectId || "").trim();
  const dateStr = String(body?.date || "").trim();
  const issues = (Array.isArray(body?.issues) ? body.issues : []) as IssueRow[];

  if (!projectId || !dateStr) {
    return NextResponse.json({ ok: false, message: "missing projectId/date" }, { status: 400 });
  }

  const date = toDateOnly(dateStr);
  if (!date) return NextResponse.json({ ok: false, message: "invalid date" }, { status: 400 });

  const cleanIssues = issues
    .map((x) => ({
      detail: String(x?.detail || "").trim(),
      imageUrl: String(x?.imageDataUrl || "").trim() || null,
    }))
    .filter((x) => x.detail || x.imageUrl);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.create({
        data: { projectId, date },
        select: { id: true, projectId: true, date: true },
      });

      if (cleanIssues.length) {
        await tx.issue.createMany({
          data: cleanIssues.map((it) => ({
            reportId: report.id,
            detail: it.detail || "-",
            imageUrl: it.imageUrl,
          })),
        });
      }

      return report;
    });

    return NextResponse.json({
      ok: true,
      reportId: created.id,
      projectId: created.projectId,
      date: created.date.toISOString(),
      hasIssues: cleanIssues.length > 0,
      issueCount: cleanIssues.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "Internal server error" }, { status: 500 });
  }
}
