import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportType = "daily" | "weekly" | "monthly";

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function formatDateOnly(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateBE(dateStr: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const year = Number(m[1]) + 543;
  const month = Number(m[2]);
  const day = Number(m[3]);

  const monthNames = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];

  return `${day} ${monthNames[month - 1] || ""} ${year}`;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const projectId = str(url.searchParams.get("projectId"));
  const type = str(url.searchParams.get("type")).toLowerCase() as ReportType;

  if (!projectId) {
    return NextResponse.json({ ok: false, message: "missing projectId" }, { status: 400 });
  }

  if (!["daily", "weekly", "monthly"].includes(type)) {
    return NextResponse.json({ ok: false, message: "invalid type" }, { status: 400 });
  }

  try {
    if (type === "daily") {
      const rows = await prisma.dailyReport.findMany({
        where: { projectId },
        orderBy: { date: "desc" },
        select: {
          id: true,
          date: true,
        },
      });

      return NextResponse.json({
        ok: true,
        type: "daily",
        items: rows.map((row) => {
          const value = formatDateOnly(row.date);
          return {
            id: row.id,
            value,
            label: formatDateBE(value),
          };
        }),
      });
    }

    if (type === "weekly") {
      const rows = await prisma.weeklyReport.findMany({
        where: { projectId },
        orderBy: [{ year: "desc" }, { weekNo: "desc" }],
        select: {
          id: true,
          year: true,
          weekNo: true,
          startDate: true,
          endDate: true,
        },
      });

      return NextResponse.json({
        ok: true,
        type: "weekly",
        items: rows.map((row) => ({
          id: row.id,
          value: formatDateOnly(row.startDate),
          label: `Week ${row.weekNo} / ${row.year}`,
          meta: {
            year: row.year,
            weekNo: row.weekNo,
            startDate: formatDateOnly(row.startDate),
            endDate: formatDateOnly(row.endDate),
          },
        })),
      });
    }

    const rows = await prisma.monthlyReport.findMany({
      where: { projectId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        id: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
      },
    });

    return NextResponse.json({
      ok: true,
      type: "monthly",
      items: rows.map((row) => ({
        id: row.id,
        value: formatDateOnly(row.startDate),
        label: `${String(row.month).padStart(2, "0")} / ${row.year}`,
        meta: {
          year: row.year,
          month: row.month,
          startDate: formatDateOnly(row.startDate),
          endDate: formatDateOnly(row.endDate),
        },
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}