import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportType = "daily" | "weekly" | "monthly";

type Supervisor = {
  name: string;
  role: string;
};

const APP_TIME_ZONE = "Asia/Bangkok";
const THAI_UTC_OFFSET_HOURS = 7;

function str(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function num(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function nullableNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function arrayOfObjects<T extends Record<string, unknown>>(v: unknown): T[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as T[];
}

function parseDateOnly(dateStr: string) {
  const s = str(dateStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;

  return { year: y, month: m, day: d };
}

function toDateOnlyUtc(dateStr: string) {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return null;

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0));
}

function toBangkokDayRangeUtc(dateStr: string) {
  const parsed = parseDateOnly(dateStr);
  if (!parsed) return null;

  const start = new Date(
    Date.UTC(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      -THAI_UTC_OFFSET_HOURS,
      0,
      0,
      0
    )
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

  return { start, end };
}

function toEndOfDayUtc(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

function norm(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normPersonName(s: string) {
  let t = String(s || "").trim();
  t = t.replace(
    /^(นาย|นางสาว|น\.ส\.|นส\.|นาง|ดร\.|ผศ\.|รศ\.|ศ\.|mr\.|mrs\.|ms\.)\s*/i,
    ""
  );
  t = t.replace(/[().,_-]/g, " ");
  return norm(t);
}

function normalizeSupervisors(raw: unknown): Supervisor[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        return {
          name: str(o.name),
          role: str(o.role),
        };
      }

      return {
        name: str(item),
        role: "",
      };
    })
    .filter((x) => x.name || x.role);
}

function normalizeProjectMeta(projectName: string, metaRaw: unknown) {
  const meta = record(metaRaw);

  return {
    projectName: str(projectName, "-"),
    contractNo: str(meta.contractNo, "-"),
    annexNo: str(meta.annexNo, "-"),
    contractStart: str(meta.contractStart, "-"),
    contractEnd: str(meta.contractEnd, "-"),
    contractorName: str(meta.contractorName, "-"),
    siteLocation: str(meta.siteLocation, "-"),
    contractValue: str(meta.contractValue, "-"),
    procurementMethod: str(meta.procurementMethod, "-"),
    installmentCount: num(meta.installmentCount, 0),
    totalDurationDays: num(meta.totalDurationDays, 0),
    dailyReportNo: str(meta.dailyReportNo, "-"),
    periodNo: str(meta.periodNo, "-"),
    weekNo: str(meta.weekNo, "-"),
  };
}

function formatDateOnlyUtc(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateOnlyInTimeZone(date: Date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";

  if (!year || !month || !day) {
    return formatDateOnlyUtc(date);
  }

  return `${year}-${month}-${day}`;
}

function getWeekRangeLabel(startDate: Date, endDate: Date) {
  return `${formatDateOnlyUtc(startDate)} ถึง ${formatDateOnlyUtc(endDate)}`;
}

function getMonthLabel(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function isDailyReportApproved(
  supervisors: Supervisor[],
  approvals: { approverName: string }[]
) {
  if (!supervisors.length) return false;

  const approvedKeys = new Set<string>();
  for (const a of approvals) {
    const a1 = norm(a.approverName);
    const a2 = normPersonName(a.approverName);
    if (a1) approvedKeys.add(a1);
    if (a2) approvedKeys.add(a2);
  }

  return supervisors.every((s) => {
    const s1 = norm(s.name);
    const s2 = normPersonName(s.name);
    return approvedKeys.has(s1) || approvedKeys.has(s2);
  });
}

function safeDateFromString(dateStr: string) {
  const s = str(dateStr);
  if (!s || s === "-") return null;

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function diffDaysInclusive(start: Date, end: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((endUtc - startUtc) / msPerDay) + 1;
}

function clampPositiveInt(value: number, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return n > 0 ? n : fallback;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const projectId = str(url.searchParams.get("projectId"));
  const type = str(url.searchParams.get("type")).toLowerCase() as ReportType;
  const dateStr = str(url.searchParams.get("date"));

  if (!projectId) {
    return NextResponse.json({ ok: false, message: "missing projectId" }, { status: 400 });
  }

  if (!["daily", "weekly", "monthly"].includes(type)) {
    return NextResponse.json({ ok: false, message: "invalid type" }, { status: 400 });
  }

  try {
    if (type === "daily") {
      const bangkokRange = toBangkokDayRangeUtc(dateStr);
      if (!bangkokRange) {
        return NextResponse.json({ ok: false, message: "invalid date" }, { status: 400 });
      }

      const report = await prisma.dailyReport.findFirst({
        where: {
          projectId,
          date: {
            gte: bangkokRange.start,
            lte: bangkokRange.end,
          },
        },
        orderBy: { date: "desc" },
        select: {
          id: true,
          projectId: true,
          date: true,
          payload: true,
          project: {
            select: {
              name: true,
              meta: true,
            },
          },
          issues: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              detail: true,
              imageUrl: true,
              comments: {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  comment: true,
                  createdAt: true,
                  author: {
                    select: {
                      name: true,
                      email: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
          approvals: {
            orderBy: { approvedAt: "asc" },
            select: {
              approverName: true,
            },
          },
        },
      });

      if (!report) {
        return NextResponse.json({
          ok: true,
          found: false,
          message: "ไม่พบ Daily report ตามวันที่เลือก",
        });
      }

      const projectMetaRaw = record(report.project?.meta);
      const supervisors = normalizeSupervisors(projectMetaRaw.supervisors);
      const approved = isDailyReportApproved(supervisors, report.approvals);

      if (!approved) {
        return NextResponse.json({
          ok: true,
          found: false,
          message: "Daily report ของวันที่เลือกยังไม่ผ่านการอนุมัติครบ จึงยังไม่แสดงในหน้าสรุปผล",
        });
      }

      const payload = record(report.payload);
      const normalizedProjectMeta = normalizeProjectMeta(report.project?.name || "-", projectMetaRaw);

      const contractStartDate = safeDateFromString(normalizedProjectMeta.contractStart);
      const contractEndDate = safeDateFromString(normalizedProjectMeta.contractEnd);

      let totalDays =
        clampPositiveInt(normalizedProjectMeta.totalDurationDays, 0) ||
        clampPositiveInt(num(projectMetaRaw.totalDurationDays, 0), 0) ||
        clampPositiveInt(num(payload.totalDays, 0), 0);

      if (!totalDays && contractStartDate && contractEndDate) {
        totalDays = clampPositiveInt(diffDaysInclusive(contractStartDate, contractEndDate), 0);
      }

      let dayNo = clampPositiveInt(num(payload.dayNo, 0), 0);

      if (!dayNo && contractStartDate) {
        dayNo = clampPositiveInt(diffDaysInclusive(contractStartDate, report.date), 0);
      }

      if (!dayNo && totalDays > 0) {
        dayNo = 1;
      }

      if (totalDays > 0 && dayNo > totalDays) {
        dayNo = totalDays;
      }

      let installmentCount =
        clampPositiveInt(normalizedProjectMeta.installmentCount, 0) ||
        clampPositiveInt(num(projectMetaRaw.installmentCount, 0), 0) ||
        clampPositiveInt(num(payload.installmentCount, 0), 0);

      let periodIndex = clampPositiveInt(num(payload.periodIndex, 0), 0);

      if (!periodIndex && dayNo > 0 && totalDays > 0 && installmentCount > 0) {
        const daysPerInstallment = totalDays / installmentCount;
        if (daysPerInstallment > 0) {
          periodIndex = clampPositiveInt(Math.ceil(dayNo / daysPerInstallment), 0);
        }
      }

      if (installmentCount > 0 && periodIndex > installmentCount) {
        periodIndex = installmentCount;
      }

      let totalWeeks = clampPositiveInt(num(payload.totalWeeks, 0), 0);
      if (!totalWeeks && totalDays > 0) {
        totalWeeks = clampPositiveInt(Math.ceil(totalDays / 7), 0);
      }

      let weekIndex = clampPositiveInt(num(payload.weekIndex, 0), 0);
      if (!weekIndex && dayNo > 0) {
        weekIndex = clampPositiveInt(Math.ceil(dayNo / 7), 0);
      }

      if (totalWeeks > 0 && weekIndex > totalWeeks) {
        weekIndex = totalWeeks;
      }

      const resolvedProjectMeta = {
        ...normalizedProjectMeta,
        dailyReportNo:
          dayNo > 0 && totalDays > 0 ? `${dayNo}/${totalDays}` : normalizedProjectMeta.dailyReportNo,
        periodNo:
          periodIndex > 0 && installmentCount > 0
            ? `${periodIndex}/${installmentCount}`
            : normalizedProjectMeta.periodNo,
        weekNo:
          weekIndex > 0 && totalWeeks > 0
            ? `${weekIndex}/${totalWeeks}`
            : normalizedProjectMeta.weekNo,
        installmentCount,
        totalDurationDays: totalDays,
      };

      const dailyModel = {
        date: formatDateOnlyInTimeZone(report.date),
        projectName: str(report.project?.name, "-"),
        projectMeta: resolvedProjectMeta,
        contractors: arrayOfObjects(payload.contractors),
        subContractors: arrayOfObjects(payload.subContractors),
        majorEquipment: arrayOfObjects(payload.majorEquipment),
        workPerformed: arrayOfObjects(payload.workPerformed),
        issues: report.issues.map((it) => ({
          id: it.id,
          detail: str(it.detail),
          imageUrl: str(it.imageUrl),
          comments: (it.comments || []).map((c) => ({
            id: c.id,
            comment: str(c.comment),
            createdAt: c.createdAt.toISOString(),
            author: c.author
              ? {
                  name: c.author.name ?? null,
                  email: c.author.email ?? null,
                  role: c.author.role ?? null,
                }
              : null,
          })),
        })),
        safetyNote: str(payload.safetyNote),
        tempMaxC: nullableNum(payload.tempMaxC),
        tempMinC: nullableNum(payload.tempMinC),
        hasOvertime: Boolean(payload.hasOvertime),
        supervisors,
        dayNo,
        totalDays,
        periodIndex,
        installmentCount,
        weekIndex,
        totalWeeks,
      };

      return NextResponse.json({
        ok: true,
        found: true,
        renderMode: "daily",
        reportType: "DAILY",
        reportId: report.id,
        documentTitle: "Daily Report Preview",
        projectId: report.projectId,
        projectName: str(report.project?.name, "-"),
        selectedDate: dateStr,
        periodLabel: dateStr,
        dailyModel,
      });
    }

    const selectedDate = toDateOnlyUtc(dateStr);
    if (!selectedDate) {
      return NextResponse.json({ ok: false, message: "invalid date" }, { status: 400 });
    }

    if (type === "weekly") {
      const selectedDateEnd = toEndOfDayUtc(selectedDate);

      const report = await prisma.weeklyReport.findFirst({
        where: {
          projectId,
          startDate: { lte: selectedDateEnd },
          endDate: { gte: selectedDate },
        },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          projectId: true,
          year: true,
          weekNo: true,
          startDate: true,
          endDate: true,
          title: true,
          summary: true,
          payload: true,
          sourceReportIds: true,
          createdAt: true,
          updatedAt: true,
          project: {
            select: {
              name: true,
              meta: true,
            },
          },
        },
      });

      if (!report) {
        return NextResponse.json({
          ok: true,
          found: false,
          message: "ไม่พบ Weekly report ตามวันที่เลือก",
        });
      }

      return NextResponse.json({
        ok: true,
        found: true,
        renderMode: "summary",
        reportType: "WEEKLY",
        reportId: report.id,
        documentTitle: `Weekly Report - Week ${report.weekNo}`,
        projectId: report.projectId,
        projectName: str(report.project?.name, "-"),
        selectedDate: formatDateOnlyUtc(selectedDate),
        periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
        summaryModel: {
          reportType: "WEEKLY",
          documentTitle: `Weekly Report - Week ${report.weekNo}`,
          projectName: str(report.project?.name, "-"),
          periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
          selectedDate: formatDateOnlyUtc(selectedDate),
          title: report.title ?? null,
          summary: report.summary ?? null,
          sourceReportIds: report.sourceReportIds || [],
          projectMeta: record(report.project?.meta),
          payload: record(report.payload),
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString(),
        },
      });
    }

    const month = selectedDate.getUTCMonth() + 1;
    const year = selectedDate.getUTCFullYear();

    const report = await prisma.monthlyReport.findUnique({
      where: {
        projectId_year_month: {
          projectId,
          year,
          month,
        },
      },
      select: {
        id: true,
        projectId: true,
        year: true,
        month: true,
        startDate: true,
        endDate: true,
        title: true,
        summary: true,
        payload: true,
        sourceReportIds: true,
        project: {
          select: {
            name: true,
            meta: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({
        ok: true,
        found: false,
        message: "ไม่พบ Monthly report ตามเดือนที่เลือก",
      });
    }

    return NextResponse.json({
      ok: true,
      found: true,
      renderMode: "summary",
      reportType: "MONTHLY",
      reportId: report.id,
      documentTitle: `Monthly Report - ${getMonthLabel(report.year, report.month)}`,
      projectId: report.projectId,
      projectName: str(report.project?.name, "-"),
      selectedDate: formatDateOnlyUtc(selectedDate),
      periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
      summaryModel: {
        reportType: "MONTHLY",
        documentTitle: `Monthly Report - ${getMonthLabel(report.year, report.month)}`,
        projectName: str(report.project?.name, "-"),
        periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
        selectedDate: formatDateOnlyUtc(selectedDate),
        title: report.title ?? null,
        summary: report.summary ?? null,
        sourceReportIds: report.sourceReportIds || [],
        projectMeta: record(report.project?.meta),
        payload: record(report.payload),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}