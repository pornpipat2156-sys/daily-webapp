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

function formatDateBE(isoOrYmd?: string) {
  if (!isoOrYmd) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return isoOrYmd;
    }
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
  }

  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return isoOrYmd;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}`;
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

function prettyLabel(key: string) {
  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPrimitive(value: unknown) {
  if (value == null) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  const s = String(value).trim();
  return s || "-";
}

function toRecordOrNull(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function toArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function renderMetaGrid(meta: Record<string, unknown>) {
  const entries = [
    ["โครงการ", meta.projectName],
    ["เลขที่สัญญา", meta.contractNo],
    ["เลขที่ภาคผนวก", meta.annexNo],
    ["เริ่มสัญญา", meta.contractStart],
    ["สิ้นสุดสัญญา", meta.contractEnd],
    ["ผู้รับจ้าง", meta.contractorName],
    ["สถานที่ก่อสร้าง", meta.siteLocation],
    ["มูลค่าสัญญา", meta.contractValue],
    ["วิธีจัดซื้อจัดจ้าง", meta.procurementMethod],
    ["งวดงาน", meta.periodNo],
    ["สัปดาห์", meta.weekNo],
    ["รายงานประจำวัน", meta.dailyReportNo],
  ];

  return `
    <div class="grid cols-2 gap-10">
      ${entries
        .map(
          ([label, value]) => `
            <div class="meta-item">
              <div class="meta-label">${escapeHtml(label)}</div>
              <div class="meta-value">${escapeHtml(formatPrimitive(value))}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderGenericTable(title: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return `
      <section class="section box avoid-break">
        <div class="section-title">${escapeHtml(title)}</div>
        <div class="empty">ไม่มีข้อมูล</div>
      </section>
    `;
  }

  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "id") set.add(k);
      });
      return set;
    }, new Set<string>())
  );

  return `
    <section class="section box avoid-break">
      <div class="section-title">${escapeHtml(title)}</div>
      <table>
        <thead>
          <tr>
            ${keys.map((key) => `<th>${escapeHtml(prettyLabel(key))}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${keys
                    .map(
                      (key) => `
                        <td>${escapeHtml(formatPrimitive(row[key]))}</td>
                      `
                    )
                    .join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderIssuesSection(model: DailyModel) {
  if (!model.issues.length) {
    return `
      <section class="section box avoid-break">
        <div class="section-title">Issues / Obstacles</div>
        <div class="empty">ไม่มีข้อมูล</div>
      </section>
    `;
  }

  return `
    <section class="section box">
      <div class="section-title">Issues / Obstacles</div>
      <div class="issue-list">
        ${model.issues
          .map((issue, index) => {
            const commentsHtml =
              issue.comments.length > 0
                ? `
                  <div class="comment-list">
                    ${issue.comments
                      .map((c) => {
                        const author =
                          c.author?.name ||
                          c.author?.email ||
                          c.author?.role ||
                          "ผู้แสดงความคิดเห็น";
                        return `
                          <div class="comment-item">
                            <div class="comment-author">${escapeHtml(author)}</div>
                            <div class="comment-body">${escapeHtml(c.comment)}</div>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                `
                : `<div class="muted">ไม่มีความคิดเห็น</div>`;

            const imageHtml = issue.imageUrl
              ? `<img class="issue-image" src="${escapeHtml(issue.imageUrl)}" alt="issue-${index + 1}" />`
              : "";

            return `
              <div class="issue-card avoid-break">
                <div class="issue-index">Issue ${index + 1}</div>
                <div class="issue-detail">${escapeHtml(issue.detail || "-")}</div>
                ${imageHtml}
                <div class="issue-comments-title">Comments</div>
                ${commentsHtml}
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSupervisors(supervisors: Supervisor[]) {
  if (!supervisors.length) {
    return `
      <section class="section box avoid-break">
        <div class="section-title">ผู้ควบคุมงาน / ผู้ลงนาม</div>
        <div class="empty">-</div>
      </section>
    `;
  }

  return `
    <section class="section box avoid-break">
      <div class="section-title">ผู้ควบคุมงาน / ผู้ลงนาม</div>
      <div class="signature-grid">
        ${supervisors
          .map(
            (item) => `
              <div class="signature-item">
                <div class="signature-line">ลงชื่อ ....................................................</div>
                <div class="signature-name">(${escapeHtml(item.name || "-")})</div>
                <div class="signature-role">${escapeHtml(item.role || " ")}</div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSummaryNode(label: string, value: unknown): string {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return `
      <div class="meta-item">
        <div class="meta-label">${escapeHtml(label)}</div>
        <div class="meta-value">${escapeHtml(formatPrimitive(value))}</div>
      </div>
    `;
  }

  const arr = toArray(value);
  if (arr.length > 0) {
    const allPrimitive = arr.every(
      (item) =>
        item == null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
    );

    const allObjects = arr.every((item) => !!toRecordOrNull(item));

    if (allPrimitive) {
      return `
        <section class="section box avoid-break">
          <div class="section-title">${escapeHtml(label)}</div>
          <ul class="bullet-list">
            ${arr.map((item) => `<li>${escapeHtml(formatPrimitive(item))}</li>`).join("")}
          </ul>
        </section>
      `;
    }

    if (allObjects) {
      const rows = arr.map((item) => toRecordOrNull(item) || {});
      return renderGenericTable(label, rows);
    }

    return `
      <section class="section box avoid-break">
        <div class="section-title">${escapeHtml(label)}</div>
        <pre class="json-block">${escapeHtml(JSON.stringify(arr, null, 2))}</pre>
      </section>
    `;
  }

  const obj = toRecordOrNull(value);
  if (obj) {
    const entries = Object.entries(obj);
    if (!entries.length) return "";

    return `
      <section class="section box avoid-break">
        <div class="section-title">${escapeHtml(label)}</div>
        <div class="grid cols-2 gap-10">
          ${entries.map(([k, v]) => renderSummaryNode(prettyLabel(k), v)).join("")}
        </div>
      </section>
    `;
  }

  return "";
}

function renderDailyHtml(data: Extract<PdfExportData, { renderMode: "daily" }>) {
  const model = data.dailyModel;

  return `
    <div class="page">
      <div class="report-shell">
        <div class="hero">
          <div class="hero-badge">DAILY REPORT</div>
          <h1 class="hero-title">Daily Report Preview</h1>
          <div class="hero-subtitle">${escapeHtml(model.projectName || "-")}</div>
        </div>

        <section class="section box avoid-break">
          <div class="section-title">ข้อมูลโครงการ</div>
          ${renderMetaGrid(model.projectMeta)}
        </section>

        <section class="section box avoid-break">
          <div class="section-title">ข้อมูลรายงาน</div>
          <div class="grid cols-2 gap-10">
            <div class="meta-item">
              <div class="meta-label">วันที่รายงาน</div>
              <div class="meta-value">${escapeHtml(formatDateBE(model.date))}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">อ้างอิงวันที่เลือก</div>
              <div class="meta-value">${escapeHtml(formatDateBE(data.selectedDate))}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">อุณหภูมิสูงสุด</div>
              <div class="meta-value">${escapeHtml(
                model.tempMaxC == null ? "-" : `${model.tempMaxC} °C`
              )}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">อุณหภูมิต่ำสุด</div>
              <div class="meta-value">${escapeHtml(
                model.tempMinC == null ? "-" : `${model.tempMinC} °C`
              )}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Overtime</div>
              <div class="meta-value">${escapeHtml(model.hasOvertime ? "มี" : "ไม่มี")}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Safety Note</div>
              <div class="meta-value">${escapeHtml(model.safetyNote || "-")}</div>
            </div>
          </div>
        </section>

        ${renderGenericTable("ผู้รับเหมา", model.contractors)}
        ${renderGenericTable("ผู้รับเหมาช่วง", model.subContractors)}
        ${renderGenericTable("เครื่องจักรหลัก", model.majorEquipment)}
        ${renderGenericTable("ผลงานที่ดำเนินการ", model.workPerformed)}
        ${renderIssuesSection(model)}
        ${renderSupervisors(model.supervisors)}
      </div>
    </div>
  `;
}

function renderSummaryHtml(
  data: Extract<PdfExportData, { renderMode: "summary" }>
) {
  const model = data.summaryModel;
  const metaEntries = Object.entries(model.projectMeta || {}).filter(
    ([k, v]) => k !== "supervisors" && v != null && String(v).trim() !== ""
  );
  const payloadEntries = Object.entries(model.payload || {});

  return `
    <div class="page">
      <div class="report-shell">
        <div class="hero">
          <div class="hero-badge">${escapeHtml(model.reportType)} REPORT</div>
          <h1 class="hero-title">${escapeHtml(model.documentTitle || "Report Preview")}</h1>
          <div class="hero-subtitle">${escapeHtml(model.projectName || "-")}</div>
        </div>

        <section class="section box avoid-break">
          <div class="grid cols-2 gap-10">
            <div class="meta-item">
              <div class="meta-label">โครงการ</div>
              <div class="meta-value">${escapeHtml(model.projectName || "-")}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">ช่วงรายงาน</div>
              <div class="meta-value">${escapeHtml(model.periodLabel || "-")}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">อ้างอิงวันที่เลือก</div>
              <div class="meta-value">${escapeHtml(model.selectedDate || "-")}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">ประเภท</div>
              <div class="meta-value">${escapeHtml(model.reportType)}</div>
            </div>
          </div>
        </section>

        ${
          model.title || model.summary
            ? `
              <section class="section box avoid-break">
                <div class="section-title">Summary</div>
                ${
                  model.title
                    ? `
                      <div class="meta-item">
                        <div class="meta-label">Title</div>
                        <div class="meta-value">${escapeHtml(model.title)}</div>
                      </div>
                    `
                    : ""
                }
                ${
                  model.summary
                    ? `
                      <div class="meta-item" style="margin-top:12px;">
                        <div class="meta-label">Summary</div>
                        <div class="meta-value multiline">${escapeHtml(model.summary)}</div>
                      </div>
                    `
                    : ""
                }
              </section>
            `
            : ""
        }

        ${
          metaEntries.length
            ? `
              <section class="section box avoid-break">
                <div class="section-title">Project Information</div>
                <div class="grid cols-2 gap-10">
                  ${metaEntries
                    .map(([k, v]) => renderSummaryNode(prettyLabel(k), v))
                    .join("")}
                </div>
              </section>
            `
            : ""
        }

        ${
          model.sourceReportIds?.length
            ? `
              <section class="section box avoid-break">
                <div class="section-title">Source Reports</div>
                <ul class="bullet-list">
                  ${model.sourceReportIds
                    .map((id) => `<li>${escapeHtml(id)}</li>`)
                    .join("")}
                </ul>
              </section>
            `
            : ""
        }

        <section class="section box">
          <div class="section-title">Preview Data</div>
          ${
            payloadEntries.length === 0
              ? `<div class="empty">ไม่พบ payload สำหรับแสดงผล</div>`
              : payloadEntries
                  .map(([k, v]) => renderSummaryNode(prettyLabel(k), v))
                  .join("")
          }
        </section>
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
        <title>${escapeHtml(data.documentTitle)}</title>
        <style>
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
            background: #eef2f7;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 1.45;
          }

          body {
            padding: 0;
          }

          .page {
            width: 100%;
          }

          .report-shell {
            width: 100%;
            background: #ffffff;
          }

          .hero {
            border: 1px solid #e2e8f0;
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #e2e8f0 100%);
            border-radius: 20px;
            padding: 18px 20px;
            margin-bottom: 16px;
          }

          .hero-badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.14em;
            color: #475569;
            margin-bottom: 8px;
          }

          .hero-title {
            font-size: 22px;
            line-height: 1.2;
            margin: 0;
            font-weight: 700;
            color: #0f172a;
          }

          .hero-subtitle {
            margin-top: 6px;
            font-size: 12px;
            color: #475569;
          }

          .section {
            margin-bottom: 14px;
          }

          .box {
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 14px;
            background: #ffffff;
          }

          .section-title {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 10px;
          }

          .grid {
            display: grid;
          }

          .cols-2 {
            grid-template-columns: 1fr 1fr;
          }

          .gap-10 {
            gap: 10px;
          }

          .meta-item {
            min-width: 0;
          }

          .meta-label {
            font-size: 10px;
            color: #64748b;
            margin-bottom: 4px;
          }

          .meta-value {
            font-size: 12px;
            color: #0f172a;
            font-weight: 600;
            word-break: break-word;
          }

          .multiline {
            white-space: pre-wrap;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            break-inside: avoid;
          }

          thead {
            display: table-header-group;
          }

          tr, td, th {
            break-inside: avoid;
          }

          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 7px;
            vertical-align: top;
            text-align: left;
            font-size: 11px;
            word-break: break-word;
          }

          th {
            background: #f8fafc;
            color: #334155;
            font-weight: 700;
          }

          .empty,
          .muted {
            color: #64748b;
            font-size: 11px;
          }

          .issue-list {
            display: grid;
            gap: 12px;
          }

          .issue-card {
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 12px;
            background: #fff;
            break-inside: avoid;
          }

          .issue-index {
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 0.08em;
            margin-bottom: 6px;
          }

          .issue-detail {
            font-size: 12px;
            color: #0f172a;
            font-weight: 600;
            margin-bottom: 8px;
            white-space: pre-wrap;
          }

          .issue-image {
            display: block;
            max-width: 100%;
            max-height: 260px;
            object-fit: contain;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            margin: 8px 0 10px;
          }

          .issue-comments-title {
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
          }

          .comment-list {
            display: grid;
            gap: 8px;
          }

          .comment-item {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 10px;
            padding: 8px;
          }

          .comment-author {
            font-size: 10px;
            font-weight: 700;
            color: #475569;
            margin-bottom: 3px;
          }

          .comment-body {
            font-size: 11px;
            color: #0f172a;
            white-space: pre-wrap;
          }

          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px 14px;
          }

          .signature-item {
            min-height: 70px;
            break-inside: avoid;
          }

          .signature-line {
            font-size: 11px;
            color: #0f172a;
            margin-bottom: 8px;
          }

          .signature-name,
          .signature-role {
            font-size: 11px;
            color: #334155;
          }

          .bullet-list {
            margin: 0;
            padding-left: 18px;
          }

          .bullet-list li {
            margin: 4px 0;
          }

          .json-block {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px;
          }

          .page-break {
            page-break-before: always;
            break-before: page;
          }

          .avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
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