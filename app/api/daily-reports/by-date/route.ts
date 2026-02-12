import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function bangkokStart(dateYmd: string) {
  // normalize เป็น 00:00 ของวันนั้นในเวลาไทย (+07:00)
  return new Date(`${dateYmd}T00:00:00.000+07:00`);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = String(searchParams.get("projectId") || "");
  const dateYmd = String(searchParams.get("date") || ""); // YYYY-MM-DD

  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return NextResponse.json({ ok: false, message: "projectId/date required" }, { status: 400 });
  }

  const start = bangkokStart(dateYmd);
  const end = addDays(start, 1);

  const found = await prisma.dailyReport.findFirst({
    where: { projectId, date: { gte: start, lt: end } },
    select: {
      id: true,
      date: true,
      payload: true,
      issues: {
        select: { id: true, detail: true, imageUrl: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    reportId: found?.id || null,
    payload: found?.payload || null,
    issues: found?.issues || [],
  });
}
