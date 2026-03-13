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
  weatherMorning?: string | null;
  weatherAfternoon?: string | null;
  weatherEvening?: string | null;
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

function nullableStr(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
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
      weatherMorning: nullableStr(payload.weatherMorning),
      weatherAfternoon: nullableStr(payload.weatherAfternoon),
      weatherEvening: nullableStr(payload.weatherEvening),
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

async function getBrowser() {
  const puppeteer = await import("puppeteer-core");
  const chromiumModule = await import("@sparticuz/chromium");
  const chromium = chromiumModule.default;

  const isVercel = Boolean(process.env.VERCEL);
  const macPath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const linuxAltPath = "/usr/bin/chromium-browser";
  const linuxPath = "/usr/bin/google-chrome";
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

export async function buildReportPdf(input: {
  previewUrl: string;
  cookieHeader?: string;
}): Promise<Buffer> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

    if (input.cookieHeader) {
      await page.setExtraHTTPHeaders({
        cookie: input.cookieHeader,
      });
    }

    const response = await page.goto(input.previewUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    if (!response) {
      throw new Error("เปิดหน้า preview สำหรับ PDF ไม่สำเร็จ");
    }

    const finalUrl = page.url();
    if (
      finalUrl.includes("/login") ||
      finalUrl.includes("/api/auth") ||
      finalUrl.includes("error")
    ) {
      throw new Error("preview route ถูก redirect หรือเข้าใช้งานไม่ได้");
    }

    await page.waitForSelector("body", {
      timeout: 15000,
    });

    await page.waitForNetworkIdle({
      idleTime: 800,
      timeout: 30000,
    }).catch(() => null);

    await page.emulateMediaType("screen");

    await page.addStyleTag({
      content: `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
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

        [data-pdf-preview-root='1'] {
          width: 794px !important;
          margin: 0 auto !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: hidden !important;
        }
      `,
    });

    const hasPdfRoot = await page.$("[data-pdf-preview-root='1']");
    if (!hasPdfRoot) {
      const bodyText = await page.evaluate(() => {
        return document.body?.innerText?.slice(0, 500) || "";
      });

      if (bodyText.includes("404") || bodyText.includes("not found")) {
        throw new Error("ไม่พบหน้า preview สำหรับสร้าง PDF");
      }

      if (bodyText.includes("sign in") || bodyText.includes("login")) {
        throw new Error("preview route ต้องเข้าสู่ระบบก่อนใช้งาน");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      omitBackground: false,
      tagged: false,
      margin: {
        top: "0mm",
        bottom: "0mm",
        left: "0mm",
        right: "0mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}