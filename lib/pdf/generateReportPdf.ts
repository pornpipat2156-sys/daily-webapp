import { prisma } from "@/lib/prisma";

export type ReportType = "daily" | "weekly" | "monthly";

type Supervisor = {
  name: string;
  role: string;
};

type DailyProjectMeta = {
  projectName: string;
  contractNo: string;
  annexNo: string;
  contractStart: string;
  contractEnd: string;
  contractorName: string;
  siteLocation: string;
  contractValue: string;
  procurementMethod: string;
  installmentCount: number;
  totalDurationDays: number;
  dailyReportNo: string;
  periodNo: string;
  weekNo: string;
};

type DailyModel = {
  date: string;
  projectName: string;
  projectMeta: DailyProjectMeta;
  contractors: Array<Record<string, unknown>>;
  subContractors: Array<Record<string, unknown>>;
  majorEquipment: Array<Record<string, unknown>>;
  workPerformed: Array<Record<string, unknown>>;
  issues: Array<{
    id: string;
    detail: string;
    imageUrl: string;
    comments: Array<{
      id: string;
      comment: string;
      createdAt: string;
      author?: {
        name?: string | null;
        email?: string | null;
        role?: string | null;
      } | null;
    }>;
  }>;
  safetyNote: string;
  tempMaxC?: number | null;
  tempMinC?: number | null;
  hasOvertime?: boolean;
  supervisors: Supervisor[];
  dayNo?: number;
  totalDays?: number;
  periodIndex?: number;
  weekIndex?: number;
  installmentCount?: number;
  totalWeeks?: number;
};

type SummaryModel = {
  reportType: "WEEKLY" | "MONTHLY";
  documentTitle: string;
  projectName: string;
  periodLabel: string;
  selectedDate: string;
  title?: string | null;
  summary?: string | null;
  sourceReportIds?: string[];
  projectMeta?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

export type PdfExportData =
  | {
      found: true;
      renderMode: "daily";
      reportType: "DAILY";
      reportId: string;
      documentTitle: string;
      projectId: string;
      projectName: string;
      selectedDate: string;
      periodLabel: string;
      dailyModel: DailyModel;
    }
  | {
      found: true;
      renderMode: "summary";
      reportType: "WEEKLY" | "MONTHLY";
      reportId: string;
      documentTitle: string;
      projectId: string;
      projectName: string;
      selectedDate: string;
      periodLabel: string;
      summaryModel: SummaryModel;
    };

export type PdfLookupResult =
  | PdfExportData
  | {
      found: false;
      message: string;
    };

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
  return v.filter(
    (x): x is T => !!x && typeof x === "object" && !Array.isArray(x)
  );
}

function toDateOnlyUtc(dateStr: string) {
  const s = str(dateStr);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
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

function formatDateOnly(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateThai(value?: string | Date | null) {
  if (!value) return "-";

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, dd] = raw.split("-").map(Number);
      return `${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
    }
    return raw;
  }

  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(
    d.getUTCMonth() + 1
  ).padStart(2, "0")}/${d.getUTCFullYear() + 543}`;
}

function getWeekRangeLabel(startDate: Date, endDate: Date) {
  return `${formatDateOnly(startDate)} ถึง ${formatDateOnly(endDate)}`;
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
  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const endUtc = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate()
  );
  return Math.floor((endUtc - startUtc) / msPerDay) + 1;
}

function clampPositiveInt(value: number, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return n > 0 ? n : fallback;
}

export async function getReportExportData(input: {
  projectId: string;
  type: ReportType;
  date: string;
}): Promise<PdfLookupResult> {
  const projectId = str(input.projectId);
  const type = str(input.type).toLowerCase() as ReportType;
  const dateStr = str(input.date);

  if (!projectId) {
    throw new Error("missing projectId");
  }

  if (!["daily", "weekly", "monthly"].includes(type)) {
    throw new Error("invalid type");
  }

  const selectedDate = toDateOnlyUtc(dateStr);
  if (!selectedDate) {
    throw new Error("invalid date");
  }

  if (type === "daily") {
    const selectedDateEnd = toEndOfDayUtc(selectedDate);

    const report = await prisma.dailyReport.findFirst({
      where: {
        projectId,
        date: {
          gte: selectedDate,
          lte: selectedDateEnd,
        },
      },
      orderBy: {
        date: "desc",
      },
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
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            detail: true,
            imageUrl: true,
            comments: {
              orderBy: {
                createdAt: "asc",
              },
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
          orderBy: {
            approvedAt: "asc",
          },
          select: {
            approverName: true,
          },
        },
      },
    });

    if (!report) {
      return {
        found: false,
        message: "ไม่พบ Daily report ตามวันที่เลือก",
      };
    }

    const projectMetaRaw = record(report.project?.meta);
    const supervisors = normalizeSupervisors(projectMetaRaw.supervisors);
    const approved = isDailyReportApproved(supervisors, report.approvals);

    if (!approved) {
      return {
        found: false,
        message:
          "Daily report ของวันที่เลือกยังไม่ผ่านการอนุมัติครบ จึงยังไม่แสดงในหน้าสรุปผล",
      };
    }

    const payload = record(report.payload);
    const normalizedProjectMeta = normalizeProjectMeta(
      report.project?.name || "-",
      projectMetaRaw
    );

    const contractStartDate = safeDateFromString(
      normalizedProjectMeta.contractStart
    );
    const contractEndDate = safeDateFromString(normalizedProjectMeta.contractEnd);

    let totalDays =
      clampPositiveInt(normalizedProjectMeta.totalDurationDays, 0) ||
      clampPositiveInt(num(projectMetaRaw.totalDurationDays, 0), 0) ||
      clampPositiveInt(num(payload.totalDays, 0), 0);

    if (!totalDays && contractStartDate && contractEndDate) {
      totalDays = clampPositiveInt(
        diffDaysInclusive(contractStartDate, contractEndDate),
        0
      );
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

    const resolvedProjectMeta: DailyProjectMeta = {
      ...normalizedProjectMeta,
      dailyReportNo:
        dayNo > 0 && totalDays > 0
          ? `${dayNo}/${totalDays}`
          : normalizedProjectMeta.dailyReportNo,
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

    const dailyModel: DailyModel = {
      date: report.date.toISOString(),
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

    return {
      found: true,
      renderMode: "daily",
      reportType: "DAILY",
      reportId: report.id,
      documentTitle: "Daily Report Preview",
      projectId: report.projectId,
      projectName: str(report.project?.name, "-"),
      selectedDate: formatDateOnly(selectedDate),
      periodLabel: formatDateOnly(selectedDate),
      dailyModel,
    };
  }

  if (type === "weekly") {
    const selectedDateEnd = toEndOfDayUtc(selectedDate);

    const report = await prisma.weeklyReport.findFirst({
      where: {
        projectId,
        startDate: {
          lte: selectedDateEnd,
        },
        endDate: {
          gte: selectedDate,
        },
      },
      orderBy: {
        startDate: "desc",
      },
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
        project: {
          select: {
            name: true,
            meta: true,
          },
        },
      },
    });

    if (!report) {
      return {
        found: false,
        message: "ไม่พบ Weekly report ตามวันที่เลือก",
      };
    }

    return {
      found: true,
      renderMode: "summary",
      reportType: "WEEKLY",
      reportId: report.id,
      documentTitle: `Weekly Report - Week ${report.weekNo}`,
      projectId: report.projectId,
      projectName: str(report.project?.name, "-"),
      selectedDate: formatDateOnly(selectedDate),
      periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
      summaryModel: {
        reportType: "WEEKLY",
        documentTitle: `Weekly Report - Week ${report.weekNo}`,
        projectName: str(report.project?.name, "-"),
        periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
        selectedDate: formatDateOnly(selectedDate),
        title: report.title ?? null,
        summary: report.summary ?? null,
        sourceReportIds: report.sourceReportIds || [],
        projectMeta: record(report.project?.meta),
        payload: record(report.payload),
      },
    };
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
    return {
      found: false,
      message: "ไม่พบ Monthly report ตามเดือนที่เลือก",
    };
  }

  return {
    found: true,
    renderMode: "summary",
    reportType: "MONTHLY",
    reportId: report.id,
    documentTitle: `Monthly Report - ${getMonthLabel(report.year, report.month)}`,
    projectId: report.projectId,
    projectName: str(report.project?.name, "-"),
    selectedDate: formatDateOnly(selectedDate),
    periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
    summaryModel: {
      reportType: "MONTHLY",
      documentTitle: `Monthly Report - ${getMonthLabel(
        report.year,
        report.month
      )}`,
      projectName: str(report.project?.name, "-"),
      periodLabel: getWeekRangeLabel(report.startDate, report.endDate),
      selectedDate: formatDateOnly(selectedDate),
      title: report.title ?? null,
      summary: report.summary ?? null,
      sourceReportIds: report.sourceReportIds || [],
      projectMeta: record(report.project?.meta),
      payload: record(report.payload),
    },
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function valueOrDash(value: unknown) {
  const s = str(value);
  return s || "-";
}

function renderTableRows(
  rows: string[][],
  emptyCols: number,
  emptyMessage = "-"
) {
  if (!rows.length) {
    return `<tr><td colspan="${emptyCols}" class="ta-center">${escapeHtml(
      emptyMessage
    )}</td></tr>`;
  }

  return rows
    .map(
      (row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    )
    .join("");
}

function buildDailyTables(model: DailyModel) {
  const contractorRows = model.contractors.map((row, index) => [
    String(index + 1),
    valueOrDash(row.name),
    valueOrDash(row.position),
    valueOrDash(row.qty),
  ]);

  const subContractorRows = model.subContractors.map((row, index) => [
    String(index + 1),
    valueOrDash(row.position),
    valueOrDash(row.morning),
    valueOrDash(row.afternoon),
    valueOrDash(row.overtime),
  ]);

  const equipmentRows = model.majorEquipment.map((row, index) => [
    String(index + 1),
    valueOrDash(row.type),
    valueOrDash(row.morning),
    valueOrDash(row.afternoon),
    valueOrDash(row.overtime),
  ]);

  const workRows = model.workPerformed.map((row) => [
    valueOrDash(row.qty),
    valueOrDash(row.desc),
    valueOrDash(row.unit),
    valueOrDash(row.location),
    valueOrDash(row.materialDelivered),
  ]);

  return {
    contractorRows,
    subContractorRows,
    equipmentRows,
    workRows,
  };
}

function renderIssueBlocks(model: DailyModel) {
  if (!model.issues.length) {
    return `<div class="issue-empty">ไม่มีข้อมูล</div>`;
  }

  return model.issues
    .map((issue, index) => {
      const authorLines =
        issue.comments.length > 0
          ? issue.comments
              .map((comment) => {
                const author =
                  comment.author?.name ||
                  comment.author?.email ||
                  comment.author?.role ||
                  "ผู้แสดงความคิดเห็น";
                return `
                  <div class="comment-item">
                    <div class="comment-author">${escapeHtml(author)}</div>
                    <div class="comment-body">${escapeHtml(comment.comment || "-")}</div>
                  </div>
                `;
              })
              .join("")
          : `<div class="comment-item"><div class="comment-body">ไม่มีความคิดเห็น</div></div>`;

      const imageBlock = issue.imageUrl
        ? `<div class="issue-image-wrap"><img class="issue-image" src="${escapeHtml(
            issue.imageUrl
          )}" alt="issue-${index + 1}" /></div>`
        : "";

      return `
        <div class="issue-card">
          <div class="issue-title">Issue ${index + 1}</div>
          <div class="issue-detail">${escapeHtml(issue.detail || "-")}</div>
          ${imageBlock}
          <div class="comment-list">${authorLines}</div>
        </div>
      `;
    })
    .join("");
}

function renderSupervisorBlocks(supervisors: Supervisor[]) {
  if (!supervisors.length) {
    return `
      <div class="signature-card">
        <div class="signature-role">-</div>
        <div class="signature-line"></div>
        <div class="signature-name">(-)</div>
      </div>
    `;
  }

  return supervisors
    .map(
      (item) => `
        <div class="signature-card">
          <div class="signature-role">${escapeHtml(item.role || "/")}</div>
          <div class="signature-line"></div>
          <div class="signature-name">(${escapeHtml(item.name || "-")})</div>
        </div>
      `
    )
    .join("");
}

function renderLogoBlock(projectName: string) {
  const initial = projectName.trim().charAt(0) || "R";

  return `
    <div class="logo-circle">
      <div class="logo-inner">${escapeHtml(initial)}</div>
    </div>
  `;
}

function renderDailyHtml(data: Extract<PdfExportData, { renderMode: "daily" }>) {
  const model = data.dailyModel;
  const meta = model.projectMeta;
  const {
    contractorRows,
    subContractorRows,
    equipmentRows,
    workRows,
  } = buildDailyTables(model);

  return `
    <div class="daily-document">
      <div class="daily-sheet">
        <div class="form-shell">
          <table class="report-head">
            <tr>
              <td class="logo-cell">
                ${renderLogoBlock(model.projectName)}
              </td>
              <td class="title-cell">
                <div class="title-main">รายงานการควบคุมงานก่อสร้างประจำวัน (DAILY REPORT)</div>
                <div class="title-sub">ประจำวันที่ ${escapeHtml(
                  formatDateThai(model.date)
                )}</div>
                <div class="title-project">โครงการ : ${escapeHtml(
                  model.projectName || "-"
                )}</div>
              </td>
            </tr>
          </table>

          <table class="meta-table">
            <tr>
              <th>สัญญาจ้าง</th>
              <td>${escapeHtml(meta.contractNo || "-")}</td>
              <th>สถานที่ก่อสร้าง</th>
              <td>${escapeHtml(meta.siteLocation || "-")}</td>
            </tr>
            <tr>
              <th>บันทึกแบบท้ายที่</th>
              <td>${escapeHtml(meta.dailyReportNo || "-")}</td>
              <th>วงเงินค่าก่อสร้าง</th>
              <td>${escapeHtml(meta.contractValue || "-")}</td>
            </tr>
            <tr>
              <th>เริ่มสัญญา</th>
              <td>${escapeHtml(formatDateThai(meta.contractStart))}</td>
              <th>ผู้รับจ้าง</th>
              <td>${escapeHtml(meta.contractorName || "-")}</td>
            </tr>
            <tr>
              <th>สิ้นสุดสัญญา</th>
              <td>${escapeHtml(formatDateThai(meta.contractEnd))}</td>
              <th>จัดจ้างโดยวิธี</th>
              <td>${escapeHtml(meta.procurementMethod || "-")}</td>
            </tr>
            <tr>
              <th>จำนวนงวด</th>
              <td>${escapeHtml(
                meta.installmentCount ? String(meta.installmentCount) : "-"
              )}</td>
              <th>รวมเวลาก่อสร้าง</th>
              <td>${escapeHtml(
                meta.totalDurationDays ? `${meta.totalDurationDays} วัน` : "-"
              )}</td>
            </tr>
          </table>

          <div class="work-weather-wrap">
            <div class="work-weather-left">
              <div class="box-title">ช่วงเวลาทำงาน</div>
              <div class="time-row">
                <div>ช่วงเช้า 08:30น.-12:00น.</div>
                <div>ช่วงบ่าย 13:00น.-17:00น.</div>
                <div>ล่วงเวลา 17:00น. ขึ้นไป</div>
              </div>

              <div class="box-title weather-title">สภาพอากาศ (WEATHER)</div>
              <div class="weather-row">
                <div>อุณหภูมิ สูงสุด: ${escapeHtml(
                  model.tempMaxC == null ? "-°C" : `${model.tempMaxC}°C`
                )}</div>
                <div>อุณหภูมิ ต่ำสุด: ${escapeHtml(
                  model.tempMinC == null ? "-°C" : `${model.tempMinC}°C`
                )}</div>
              </div>
              <div class="weather-row weather-row-2">
                <div>เช้า: -</div>
                <div>บ่าย: -</div>
                <div>ล่วงเวลา: ${escapeHtml(model.hasOvertime ? "มี" : "-")}</div>
              </div>
            </div>

            <div class="work-weather-right">
              <div class="mini-box">${escapeHtml(meta.dailyReportNo || "-")}</div>
              <div class="mini-box">${escapeHtml(meta.periodNo || "-")}</div>
              <div class="mini-box">${escapeHtml(meta.weekNo || "-")}</div>
            </div>
          </div>
        </div>

        <div class="team-shell">
          <div class="section-banner">ส่วนโครงการ (PROJECT TEAM)</div>

          <div class="team-grid">
            <div class="team-col">
              <div class="team-title">ผู้รับเหมา<br />(CONTRACTORS)</div>
              <table class="team-table">
                <thead>
                  <tr>
                    <th class="col-no">#</th>
                    <th>รายชื่อ</th>
                    <th>ตำแหน่ง</th>
                    <th class="col-qty">จำนวน</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderTableRows(contractorRows, 4)}
                </tbody>
              </table>
            </div>

            <div class="team-col">
              <div class="team-title">ผู้รับเหมารายย่อย<br />(SUB CONTRACTORS)</div>
              <table class="team-table">
                <thead>
                  <tr>
                    <th class="col-no">#</th>
                    <th>ตำแหน่ง</th>
                    <th class="col-sm">เช้า</th>
                    <th class="col-sm">บ่าย</th>
                    <th class="col-sm">ล่วงเวลา</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderTableRows(subContractorRows, 5)}
                </tbody>
              </table>
            </div>

            <div class="team-col">
              <div class="team-title">เครื่องจักรหลัก<br />(MAJOR EQUIPMENT)</div>
              <table class="team-table">
                <thead>
                  <tr>
                    <th class="col-no">#</th>
                    <th>ชนิด</th>
                    <th class="col-sm">เช้า</th>
                    <th class="col-sm">บ่าย</th>
                    <th class="col-sm">ล่วงเวลา</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderTableRows(equipmentRows, 5)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="page-break"></div>

        <div class="detail-shell">
          <table class="detail-table">
            <thead>
              <tr>
                <th class="col-w-qty">จำนวน</th>
                <th>ผลงานที่ดำเนินการ</th>
                <th class="col-w-unit">หน่วย</th>
                <th>สถานที่</th>
                <th>วัสดุที่ส่งมอบ</th>
              </tr>
            </thead>
            <tbody>
              ${renderTableRows(workRows, 5)}
            </tbody>
          </table>

          <div class="issues-shell">
            <div class="detail-title">Issues / Obstacles</div>
            ${renderIssueBlocks(model)}
          </div>

          <div class="signature-shell">
            ${renderSupervisorBlocks(model.supervisors)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSummaryValue(label: string, value: unknown): string {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${escapeHtml(str(value, "-"))}</td>
      </tr>
    `;
  }

  if (Array.isArray(value)) {
    return `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></td>
      </tr>
    `;
  }

  return `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></td>
    </tr>
  `;
}

function renderSummaryHtml(
  data: Extract<PdfExportData, { renderMode: "summary" }>
) {
  const model = data.summaryModel;
  const payloadEntries = Object.entries(model.payload || {});
  const metaEntries = Object.entries(model.projectMeta || {});

  return `
    <div class="summary-document">
      <div class="summary-card">
        <div class="summary-title">${escapeHtml(model.documentTitle || "Report")}</div>
        <div class="summary-subtitle">${escapeHtml(model.projectName || "-")}</div>

        <table class="summary-table">
          <tr>
            <th>ประเภท</th>
            <td>${escapeHtml(model.reportType)}</td>
          </tr>
          <tr>
            <th>ช่วงรายงาน</th>
            <td>${escapeHtml(model.periodLabel || "-")}</td>
          </tr>
          <tr>
            <th>วันที่อ้างอิง</th>
            <td>${escapeHtml(model.selectedDate || "-")}</td>
          </tr>
          <tr>
            <th>Title</th>
            <td>${escapeHtml(model.title || "-")}</td>
          </tr>
          <tr>
            <th>Summary</th>
            <td>${escapeHtml(model.summary || "-")}</td>
          </tr>
        </table>

        ${
          metaEntries.length
            ? `
              <div class="summary-section-title">Project Meta</div>
              <table class="summary-table">
                ${metaEntries
                  .map(([key, value]) => renderSummaryValue(key, value))
                  .join("")}
              </table>
            `
            : ""
        }

        ${
          payloadEntries.length
            ? `
              <div class="summary-section-title">Payload</div>
              <table class="summary-table">
                ${payloadEntries
                  .map(([key, value]) => renderSummaryValue(key, value))
                  .join("")}
              </table>
            `
            : ""
        }
      </div>
    </div>
  `;
}

function buildDocumentHtml(data: PdfExportData) {
  const body =
    data.renderMode === "daily" ? renderDailyHtml(data) : renderSummaryHtml(data);

  return `
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(data.documentTitle)}</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap");

          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111111;
            font-family: "Noto Sans Thai", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.35;
          }

          body {
            width: 100%;
          }

          .page-break {
            page-break-before: always;
            break-before: page;
          }

          .daily-document,
          .summary-document {
            width: 100%;
          }

          .daily-sheet {
            width: 100%;
          }

          .form-shell,
          .team-shell,
          .detail-shell {
            border: 2px solid #1b1b1b;
            border-radius: 18px;
            padding: 12px 14px;
            margin-bottom: 16px;
            overflow: hidden;
          }

          .report-head,
          .meta-table,
          .detail-table,
          .team-table,
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .report-head td,
          .meta-table th,
          .meta-table td,
          .detail-table th,
          .detail-table td,
          .team-table th,
          .team-table td,
          .summary-table th,
          .summary-table td {
            border: 1.6px solid #1b1b1b;
          }

          .logo-cell {
            width: 145px;
            height: 150px;
            text-align: center;
            vertical-align: middle;
            background: #ffffff;
          }

          .title-cell {
            background: #e6daf2;
            text-align: center;
            padding: 14px 18px;
          }

          .title-main {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 6px;
          }

          .title-sub {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
          }

          .title-project {
            font-size: 14px;
            font-weight: 600;
          }

          .logo-circle {
            width: 92px;
            height: 92px;
            margin: 0 auto;
            border-radius: 50%;
            border: 5px solid #22754f;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at 35% 35%, #efe5ff 0%, #d2b5eb 58%, #c89fe4 100%);
          }

          .logo-inner {
            width: 68px;
            height: 68px;
            border-radius: 50%;
            border: 2px solid #4a3f56;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            font-weight: 700;
            color: #3f3150;
            background: #f9f4ff;
          }

          .meta-table th,
          .meta-table td {
            padding: 8px 10px;
            font-size: 12px;
            vertical-align: middle;
          }

          .meta-table th {
            width: 18%;
            text-align: left;
            font-weight: 600;
            background: #ffffff;
          }

          .meta-table td {
            width: 32%;
            background: #ffffff;
          }

          .work-weather-wrap {
            margin-top: 8px;
            display: grid;
            grid-template-columns: 1fr 220px;
            gap: 0;
            border: 2px solid #23314f;
          }

          .work-weather-left {
            padding: 12px 14px;
            background: #f5f2df;
            border-right: 2px solid #23314f;
            min-height: 124px;
          }

          .work-weather-right {
            background: #f5f2df;
            display: grid;
            grid-template-rows: repeat(3, 1fr);
            gap: 10px;
            padding: 10px;
          }

          .mini-box {
            border: 2px solid #23314f;
            background: #f5f2df;
            min-height: 54px;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 0 12px;
            font-size: 13px;
            font-weight: 500;
          }

          .box-title {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 6px;
          }

          .weather-title {
            margin-top: 10px;
          }

          .time-row,
          .weather-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            font-size: 11px;
          }

          .weather-row {
            grid-template-columns: 1fr 1fr;
            margin-top: 2px;
          }

          .weather-row-2 {
            grid-template-columns: 1fr 1fr 1fr;
            margin-top: 6px;
          }

          .section-banner {
            background: #d9ead8;
            border: 2px solid #1b1b1b;
            border-bottom: 0;
            margin: -12px -14px 0 -14px;
            padding: 8px 12px;
            text-align: center;
            font-size: 13px;
            font-weight: 700;
          }

          .team-grid {
            display: grid;
            grid-template-columns: 1.2fr 1fr 1fr;
            gap: 0;
          }

          .team-col {
            border-left: 1px solid #1b1b1b;
          }

          .team-col:first-child {
            border-left: 0;
          }

          .team-title {
            text-align: center;
            font-size: 12px;
            font-weight: 700;
            padding: 10px 8px;
            min-height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
          }

          .team-table th,
          .team-table td {
            padding: 6px 6px;
            font-size: 11px;
            vertical-align: top;
            word-break: break-word;
            background: #ffffff;
          }

          .team-table th {
            text-align: center;
            font-weight: 700;
          }

          .col-no {
            width: 40px;
            text-align: center;
          }

          .col-qty,
          .col-sm {
            width: 64px;
            text-align: center;
          }

          .detail-table {
            margin-bottom: 16px;
          }

          .detail-table th,
          .detail-table td {
            padding: 8px 8px;
            font-size: 11px;
            vertical-align: top;
            background: #ffffff;
            word-break: break-word;
          }

          .detail-table th {
            text-align: center;
            font-weight: 700;
          }

          .col-w-qty {
            width: 70px;
          }

          .col-w-unit {
            width: 75px;
          }

          .detail-title {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .issues-shell {
            border: 1.8px solid #1b1b1b;
            border-radius: 16px;
            padding: 12px;
            min-height: 120px;
            margin-bottom: 16px;
          }

          .issue-empty {
            font-size: 11px;
          }

          .issue-card {
            border: 1px solid #b7b7b7;
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 10px;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .issue-card:last-child {
            margin-bottom: 0;
          }

          .issue-title {
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 6px;
          }

          .issue-detail {
            white-space: pre-wrap;
            font-size: 11px;
            margin-bottom: 8px;
          }

          .issue-image-wrap {
            margin-bottom: 8px;
          }

          .issue-image {
            max-width: 100%;
            max-height: 220px;
            border: 1px solid #b7b7b7;
            border-radius: 8px;
            display: block;
          }

          .comment-list {
            display: grid;
            gap: 8px;
          }

          .comment-item {
            border: 1px solid #d0d0d0;
            border-radius: 8px;
            padding: 8px;
          }

          .comment-author {
            font-size: 10px;
            font-weight: 700;
            margin-bottom: 4px;
          }

          .comment-body {
            font-size: 11px;
            white-space: pre-wrap;
          }

          .signature-shell {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px 14px;
            min-height: 110px;
          }

          .signature-card {
            border: 1.8px solid #1b1b1b;
            border-radius: 16px;
            min-height: 110px;
            padding: 14px 14px 10px;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .signature-role {
            font-size: 11px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 22px;
          }

          .signature-line {
            border-top: 1.5px dotted #222222;
            width: 82%;
            margin: 0 auto 6px;
          }

          .signature-name {
            text-align: center;
            font-size: 11px;
          }

          .ta-center {
            text-align: center;
          }

          .summary-card {
            border: 1.8px solid #1b1b1b;
            border-radius: 16px;
            padding: 16px;
          }

          .summary-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 6px;
          }

          .summary-subtitle {
            font-size: 13px;
            margin-bottom: 12px;
          }

          .summary-section-title {
            font-size: 14px;
            font-weight: 700;
            margin: 16px 0 8px;
          }

          .summary-table th,
          .summary-table td {
            padding: 8px;
            text-align: left;
            vertical-align: top;
            font-size: 11px;
          }

          .summary-table th {
            width: 180px;
            font-weight: 700;
          }

          pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: "Noto Sans Thai", Arial, sans-serif;
          }
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;
}

async function getBrowser() {
  const puppeteer = await import("puppeteer-core");
  const chromiumModule = await import("@sparticuz/chromium");
  const chromium = chromiumModule.default;

  const isVercel = Boolean(process.env.VERCEL);
  const macPath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const linuxPath = "/usr/bin/google-chrome";
  const linuxAltPath = "/usr/bin/chromium-browser";
  const winPath =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  const executablePath = isVercel
    ? await chromium.executablePath()
    : process.env.CHROME_EXECUTABLE_PATH ||
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      (process.platform === "darwin"
        ? macPath
        : process.platform === "win32"
          ? winPath
          : linuxPath || linuxAltPath);

  return puppeteer.default.launch({
    headless: true,
    executablePath,
    args: isVercel
      ? chromium.args
      : ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: {
      width: 794,
      height: 1123,
      deviceScaleFactor: 2,
    },
  });
}

export async function buildReportPdf(data: PdfExportData): Promise<Buffer> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    const html = buildDocumentHtml(data);

    await page.setContent(html, {
      waitUntil: ["domcontentloaded", "networkidle0"],
    });

    await page.emulateMediaType("screen");

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "8mm",
        bottom: "8mm",
        left: "8mm",
        right: "8mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}