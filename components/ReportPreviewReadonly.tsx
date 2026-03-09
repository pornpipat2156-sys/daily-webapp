// components/ReportPreviewReadonly.tsx
"use client";

import Image from "next/image";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Supervisor = { name: string; role: string };

export type ContractorRow = {
  id: string;
  name: string;
  position: string;
  qty: number;
};

export type SubContractorRow = {
  id: string;
  position: string;
  morning: number;
  afternoon: number;
  overtime: number;
};

export type MajorEquipmentRow = {
  id: string;
  type: string;
  morning: number;
  afternoon: number;
  overtime: number;
};

export type WorkRow = {
  id: string;
  desc: string;
  location: string;
  qty: string;
  unit: string;
  materialDelivered: string;
};

export type IssueComment = {
  id: string;
  comment: string;
  createdAt: string;
  author?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

export type IssueRowUnified = {
  id: string;
  detail: string;
  imageUrl: string;
  comments?: IssueComment[];
};

export type ProjectMetaUnified = {
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

export type ReportRenderModel = {
  date: string;
  projectName: string;
  projectMeta: ProjectMetaUnified;
  contractors: ContractorRow[];
  subContractors: SubContractorRow[];
  majorEquipment: MajorEquipmentRow[];
  workPerformed: WorkRow[];
  issues: IssueRowUnified[];
  safetyNote: string;
  tempMaxC?: number | null;
  tempMinC?: number | null;
  hasOvertime?: boolean;
  supervisors: Supervisor[];
};

type Props =
  | {
      model: ReportRenderModel;
      reportId?: never;
      renderIssueCommentCell?: (issue: IssueRowUnified, idx: number) => ReactNode;
      className?: string;
    }
  | {
      reportId: string;
      model?: never;
      renderIssueCommentCell?: (issue: IssueRowUnified, idx: number) => ReactNode;
      className?: string;
    };

type ApiAuthor = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type ApiIssueComment = {
  id?: string;
  comment?: string;
  createdAt?: string;
  author?: ApiAuthor | null;
};

type ApiIssue = {
  id?: string;
  detail?: string;
  imageUrl?: string | null;
  comments?: ApiIssueComment[];
};

type ApiProjectMeta = Partial<ProjectMetaUnified> & {
  supervisors?: Array<{ name?: string | null; role?: string | null }>;
};

type ApiRenderReport = {
  id?: string;
  projectId?: string;
  date?: string;
  projectName?: string;
  projectMeta?: ApiProjectMeta | null;
  contractors?: ContractorRow[];
  subContractors?: SubContractorRow[];
  majorEquipment?: MajorEquipmentRow[];
  workPerformed?: WorkRow[];
  issues?: ApiIssue[];
  safetyNote?: string;
  tempMaxC?: number | null;
  tempMinC?: number | null;
  hasOvertime?: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateBE(isoOrYmd?: string) {
  if (!isoOrYmd) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return isoOrYmd;
    }
    return `${pad2(d)}/${pad2(m)}/${y + 543}`;
  }

  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return isoOrYmd;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
}

function hmToMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function weatherTextFromCode(code: number | null | undefined) {
  if (code == null) return "-";
  if (code === 0) return "ท้องฟ้าแจ่มใส";
  if (code === 1 || code === 2) return "มีเมฆบางส่วน";
  if (code === 3) return "มีเมฆมาก";
  if (code === 45 || code === 48) return "หมอก";
  if (code >= 51 && code <= 57) return "ฝนปรอย";
  if (code >= 61 && code <= 67) return "ฝนตก";
  if (code >= 71 && code <= 77) return "หิมะ/ลูกเห็บ";
  if (code >= 80 && code <= 82) return "ฝนตกหนัก";
  if (code >= 95) return "พายุฝนฟ้าคะนอง";
  return "สภาพอากาศแปรปรวน";
}

async function fetchHourlyWeather(dateISO: string) {
  const lat = 18.7883;
  const lon = 98.9853;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,weathercode` +
    `&timezone=Asia%2FBangkok` +
    `&start_date=${dateISO}&end_date=${dateISO}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("hourly weather fetch failed");

  const data = await res.json();
  const times: string[] = data?.hourly?.time || [];
  const temps: number[] = data?.hourly?.temperature_2m || [];
  const codes: number[] = data?.hourly?.weathercode || [];

  return times.map((t, i) => ({
    time: t,
    temp: typeof temps[i] === "number" ? temps[i] : null,
    code: typeof codes[i] === "number" ? codes[i] : null,
  }));
}

function calcMaxMinInRange(
  hourly: { time: string; temp: number | null; code: number | null }[],
  startMin: number,
  endMin: number
) {
  let max: number | null = null;
  let min: number | null = null;

  for (const r of hourly) {
    const timePart = r.time.split("T")[1] || "00:00";
    const hm = timePart.slice(0, 5);
    const m = hmToMin(hm);

    if (m < startMin) continue;
    if (m > endMin) continue;
    if (r.temp == null) continue;

    max = max == null ? r.temp : Math.max(max, r.temp);
    min = min == null ? r.temp : Math.min(min, r.temp);
  }

  return { max, min };
}

function representativeWeather(
  hourly: { time: string; temp: number | null; code: number | null }[],
  startMin: number,
  endMin: number
) {
  const freq = new Map<number, number>();

  for (const r of hourly) {
    const timePart = r.time.split("T")[1] || "00:00";
    const hm = timePart.slice(0, 5);
    const m = hmToMin(hm);

    if (m < startMin) continue;
    if (m > endMin) continue;
    if (r.code == null) continue;

    freq.set(r.code, (freq.get(r.code) || 0) + 1);
  }

  let bestCode: number | null = null;
  let bestCount = -1;

  for (const [code, count] of freq.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestCode = code;
    }
  }

  return weatherTextFromCode(bestCode);
}

function padArray<T>(arr: T[], targetLen: number, makeEmpty: (idx: number) => T): T[] {
  const out = [...arr];
  while (out.length < targetLen) out.push(makeEmpty(out.length));
  return out.slice(0, targetLen);
}

const A4_WIDTH_PX = 794;

function computeScaleFromWidth(containerWidth: number) {
  const safeW = Math.max(0, containerWidth - 16);
  const s = Math.min(1, safeW / A4_WIDTH_PX);
  const ss = Number.isFinite(s) ? s : 1;
  const scaledW = Math.max(1, Math.floor(A4_WIDTH_PX * ss));
  return { ss, scaledW };
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toSupervisorArray(input: unknown): Supervisor[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((it) => ({
      name: String((it as { name?: unknown })?.name ?? "").trim(),
      role: String((it as { role?: unknown })?.role ?? "").trim(),
    }))
    .filter((it) => it.name || it.role);
}

function normalizeProjectMeta(
  projectName: string,
  meta?: ApiProjectMeta | null
): ProjectMetaUnified {
  return {
    projectName: String(projectName || "-"),
    contractNo: String(meta?.contractNo ?? "-"),
    annexNo: String(meta?.annexNo ?? "-"),
    contractStart: String(meta?.contractStart ?? "-"),
    contractEnd: String(meta?.contractEnd ?? "-"),
    contractorName: String(meta?.contractorName ?? "-"),
    siteLocation: String(meta?.siteLocation ?? "-"),
    contractValue: String(meta?.contractValue ?? "-"),
    procurementMethod: String(meta?.procurementMethod ?? "-"),
    installmentCount: Number(meta?.installmentCount ?? 0),
    totalDurationDays: Number(meta?.totalDurationDays ?? 0),
    dailyReportNo: String(meta?.dailyReportNo ?? "-"),
    periodNo: String(meta?.periodNo ?? "-"),
    weekNo: String(meta?.weekNo ?? "-"),
  };
}

function normalizeIssueComments(list: ApiIssueComment[] | undefined): IssueComment[] {
  if (!Array.isArray(list)) return [];
  return list.map((c, idx) => ({
    id: String(c?.id ?? `COMMENT-${idx}`),
    comment: String(c?.comment ?? ""),
    createdAt: String(c?.createdAt ?? ""),
    author: c?.author
      ? {
          name: c.author?.name ?? null,
          email: c.author?.email ?? null,
          role: c.author?.role ?? null,
        }
      : null,
  }));
}

function normalizeReport(detail: ApiRenderReport): ReportRenderModel {
  const projectName = String(detail?.projectName ?? "-");
  const meta = detail?.projectMeta ?? null;

  const issues: IssueRowUnified[] = Array.isArray(detail?.issues)
    ? detail.issues.map((it, idx) => ({
        id: String(it?.id ?? `ISSUE-${idx}`),
        detail: String(it?.detail ?? ""),
        imageUrl: String(it?.imageUrl ?? ""),
        comments: normalizeIssueComments(it?.comments),
      }))
    : [];

  return {
    date: String(detail?.date ?? ""),
    projectName,
    projectMeta: normalizeProjectMeta(projectName, meta),
    contractors: Array.isArray(detail?.contractors) ? detail.contractors : [],
    subContractors: Array.isArray(detail?.subContractors) ? detail.subContractors : [],
    majorEquipment: Array.isArray(detail?.majorEquipment) ? detail.majorEquipment : [],
    workPerformed: Array.isArray(detail?.workPerformed) ? detail.workPerformed : [],
    issues,
    safetyNote: String(detail?.safetyNote ?? ""),
    tempMaxC: detail?.tempMaxC ?? null,
    tempMinC: detail?.tempMinC ?? null,
    hasOvertime: Boolean(detail?.hasOvertime),
    supervisors: toSupervisorArray(meta?.supervisors ?? []),
  };
}

function SignatureGrid({ items }: { items: Supervisor[] }) {
  const clean = (items || [])
    .map((x) => ({
      name: String(x?.name || "").trim(),
      role: String(x?.role || "").trim(),
    }))
    .filter((x) => x.name || x.role);

  if (!clean.length) return <div className="text-center py-2">-</div>;

  const rows = chunk(clean, 5);

  return (
    <div className="sigWrap">
      {rows.map((row, ri) => (
        <div key={ri} className="sigRow">
          {row.map((it, i) => (
            <div key={`${ri}-${i}`} className="sigItem">
              <div>ลงชื่อ ................................</div>
              <div>({it.name || "-"})</div>
              <div>{it.role || " "}</div>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 5 - row.length) }).map((_, i) => (
            <div key={`empty-${ri}-${i}`} className="sigItem" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ReportPreviewReadonly(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [scaledWidth, setScaledWidth] = useState(A4_WIDTH_PX);

  const [remoteModel, setRemoteModel] = useState<ReportRenderModel | null>(
    ("model" in props ? props.model : null) ?? null
  );
  const [loadingModel, setLoadingModel] = useState(false);
  const [loadError, setLoadError] = useState("");

  const model = "model" in props ? props.model ?? null : remoteModel;
  const renderIssueCommentCell = props.renderIssueCommentCell;
  const className = props.className;

  useEffect(() => {
    if ("model" in props) {
      setRemoteModel(props.model ?? null);
      setLoadError("");
      setLoadingModel(false);
      return;
    }

    const reportId = String(props.reportId || "").trim();
    if (!reportId) {
      setRemoteModel(null);
      setLoadError("ไม่พบ reportId สำหรับเปิด Preview");
      setLoadingModel(false);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoadingModel(true);
      setLoadError("");

      try {
        const res = await fetch(
          `/api/daily-reports/${encodeURIComponent(reportId)}?mode=render`,
          {
            cache: "no-store",
          }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            String(json?.message || json?.error || "โหลดข้อมูล Preview ไม่สำเร็จ")
          );
        }
        if (cancelled) return;
        setRemoteModel(normalizeReport((json ?? {}) as ApiRenderReport));
      } catch (e: unknown) {
        if (cancelled) return;
        setRemoteModel(null);
        setLoadError(e instanceof Error ? e.message : "โหลดข้อมูล Preview ไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoadingModel(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [props]);

  const [wxLoading, setWxLoading] = useState(false);
  const [tempMax, setTempMax] = useState<number | null>(model?.tempMaxC ?? null);
  const [tempMin, setTempMin] = useState<number | null>(model?.tempMinC ?? null);
  const [wMorning, setWMorning] = useState("-");
  const [wAfternoon, setWAfternoon] = useState("-");
  const [wOvertime, setWOvertime] = useState("-");

  useEffect(() => {
    setTempMax(model?.tempMaxC ?? null);
    setTempMin(model?.tempMinC ?? null);
  }, [model?.tempMaxC, model?.tempMinC]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const w = el.clientWidth || A4_WIDTH_PX;
      const { ss, scaledW } = computeScaleFromWidth(w);
      setScale(ss);
      setScaledWidth(scaledW);
    };

    updateScale();

    const ro = new ResizeObserver(() => updateScale());
    ro.observe(el);

    window.addEventListener("resize", updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadWeather() {
      if (!model?.date) return;

      const alreadyHasManualTemp =
        typeof model.tempMaxC === "number" || typeof model.tempMinC === "number";

      if (alreadyHasManualTemp) return;

      setWxLoading(true);

      try {
        const hourly = await fetchHourlyWeather(model.date);
        if (!alive) return;

        const morning = calcMaxMinInRange(hourly, hmToMin("08:30"), hmToMin("12:00"));
        const afternoon = calcMaxMinInRange(hourly, hmToMin("13:00"), hmToMin("17:00"));
        const overtime = calcMaxMinInRange(hourly, hmToMin("17:00"), hmToMin("23:59"));

        const maxCand = [morning.max, afternoon.max, overtime.max].filter(
          (v): v is number => typeof v === "number"
        );
        const minCand = [morning.min, afternoon.min, overtime.min].filter(
          (v): v is number => typeof v === "number"
        );

        setTempMax(maxCand.length ? Math.max(...maxCand) : null);
        setTempMin(minCand.length ? Math.min(...minCand) : null);
        setWMorning(representativeWeather(hourly, hmToMin("08:30"), hmToMin("12:00")));
        setWAfternoon(representativeWeather(hourly, hmToMin("13:00"), hmToMin("17:00")));
        setWOvertime(representativeWeather(hourly, hmToMin("17:00"), hmToMin("23:59")));
      } catch {
        if (!alive) return;
        setWMorning("-");
        setWAfternoon("-");
        setWOvertime("-");
      } finally {
        if (alive) setWxLoading(false);
      }
    }

    loadWeather();

    return () => {
      alive = false;
    };
  }, [model?.date, model?.tempMaxC, model?.tempMinC]);

  if (loadingModel) {
    return (
      <div ref={containerRef} className={className}>
        <div className="rounded-[24px] border border-slate-200 bg-white/90 px-6 py-10 text-center text-sm text-slate-600 shadow-[0_10px_30px_rgba(148,163,184,0.12)] dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
          กำลังโหลด Preview...
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div ref={containerRef} className={className}>
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-6 py-10 text-center text-sm text-rose-700 shadow-[0_10px_30px_rgba(148,163,184,0.12)] dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {loadError || "ไม่พบข้อมูล Preview"}
        </div>
      </div>
    );
  }

  const pm = model.projectMeta;

  const contractorsPadded = useMemo(
    () =>
      padArray(model.contractors || [], 7, (idx) => ({
        id: `EMPTY-C-${idx}`,
        name: "",
        position: "",
        qty: 0,
      })),
    [model.contractors]
  );

  const subPadded = useMemo(
    () =>
      padArray(model.subContractors || [], 7, (idx) => ({
        id: `EMPTY-S-${idx}`,
        position: "",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [model.subContractors]
  );

  const equipPadded = useMemo(
    () =>
      padArray(model.majorEquipment || [], 7, (idx) => ({
        id: `EMPTY-E-${idx}`,
        type: "",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [model.majorEquipment]
  );

  const contractorTotal = useMemo(
    () => (model.contractors || []).reduce((sum, r) => sum + (Number(r.qty) || 0), 0),
    [model.contractors]
  );

  const subTotals = useMemo(
    () => ({
      morning: (model.subContractors || []).reduce((sum, r) => sum + (Number(r.morning) || 0), 0),
      afternoon: (model.subContractors || []).reduce(
        (sum, r) => sum + (Number(r.afternoon) || 0),
        0
      ),
      overtime: (model.subContractors || []).reduce(
        (sum, r) => sum + (Number(r.overtime) || 0),
        0
      ),
    }),
    [model.subContractors]
  );

  const equipTotals = useMemo(
    () => ({
      morning: (model.majorEquipment || []).reduce((sum, r) => sum + (Number(r.morning) || 0), 0),
      afternoon: (model.majorEquipment || []).reduce(
        (sum, r) => sum + (Number(r.afternoon) || 0),
        0
      ),
      overtime: (model.majorEquipment || []).reduce(
        (sum, r) => sum + (Number(r.overtime) || 0),
        0
      ),
    }),
    [model.majorEquipment]
  );

  const issuesList = useMemo(() => model.issues || [], [model.issues]);
  const hasIssues = issuesList.length > 0;

  return (
    <div ref={containerRef} className={className}>
      <div
        style={{
          width: `${scaledWidth}px`,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: `${A4_WIDTH_PX}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top center",
          }}
        >
          <div className="previewRoot">
            <div className="page">
              <div className="header">
                <div className="headerLeft">
                  <div className="logoBox">
                    <Image src="/logo.png" alt="logo" width={56} height={56} />
                  </div>
                </div>

                <div className="headerCenter">
                  <div className="titleTH">แบบรายงานประจำวัน</div>
                  <div className="titleEN">(DAILY REPORT)</div>
                  <div className="projectName">{model.projectName || pm.projectName || "-"}</div>
                </div>

                <div className="headerRight">
                  <div className="dateBox">
                    <div className="dateLabel">ประจำวันที่</div>
                    <div className="dateValue">{formatDateBE(model.date)}</div>
                  </div>
                </div>
              </div>

              <table className="mainTable">
                <tbody>
                  <tr>
                    <td className="cell w55">
                      <div className="labelStrong">ชื่อโครงการ</div>
                      <div>{pm.projectName || "-"}</div>
                    </td>
                    <td className="cell w45">
                      <div className="labelStrong">สัญญาจ้างเลขที่</div>
                      <div>{pm.contractNo || "-"}</div>
                    </td>
                  </tr>

                  <tr>
                    <td className="cell">
                      <div>
                        บันทึกแนบท้ายที่ {pm.annexNo || "-"} วงเงินค่าก่อสร้าง{" "}
                        {pm.contractValue || "-"}
                      </div>
                    </td>
                    <td className="cell">
                      <div>สถานที่ก่อสร้าง {pm.siteLocation || "-"}</div>
                    </td>
                  </tr>

                  <tr>
                    <td className="cell">
                      <div>เริ่มสัญญา {formatDateBE(pm.contractStart)}</div>
                    </td>
                    <td className="cell">
                      <div>สิ้นสุดสัญญา {formatDateBE(pm.contractEnd)}</div>
                    </td>
                  </tr>

                  <tr>
                    <td className="cell">
                      <div>ผู้รับจ้าง {pm.contractorName || "-"}</div>
                    </td>
                    <td className="cell">
                      <div>จัดจ้างโดยวิธี {pm.procurementMethod || "-"}</div>
                    </td>
                  </tr>

                  <tr>
                    <td className="cell">
                      <div>จำนวนงวด {pm.installmentCount || 0}</div>
                    </td>
                    <td className="cell">
                      <div>รวมเวลาก่อสร้าง {pm.totalDurationDays || 0} วัน</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="mainTable mt8">
                <tbody>
                  <tr>
                    <td className="cell w34">
                      <div className="labelStrong">ช่วงเวลาทำงาน</div>
                      <div>ช่วงเช้า 08:30น.-12:00น.</div>
                      <div>ช่วงบ่าย 13:00น.-17:00น.</div>
                      <div>ล่วงเวลา 17:00น. ขึ้นไป</div>
                    </td>

                    <td className="cell w38">
                      <div className="labelStrong">สภาพอากาศ (WEATHER)</div>
                      {wxLoading ? (
                        <div>กำลังดึงข้อมูลอุณหภูมิ/สภาพอากาศ...</div>
                      ) : (
                        <>
                          <div>
                            อุณหภูมิ สูงสุด: {tempMax ?? "-"}°C อุณหภูมิ ต่ำสุด:{" "}
                            {tempMin ?? "-"}°C
                          </div>
                          <div>เช้า: {wMorning}</div>
                          <div>บ่าย: {wAfternoon}</div>
                          <div>ล่วงเวลา: {wOvertime}</div>
                        </>
                      )}
                    </td>

                    <td className="cell w28">
                      <div>เลขที่รายงาน {pm.dailyReportNo || "-"}</div>
                      <div>งวดที่ {pm.periodNo || "-"}</div>
                      <div>สัปดาห์ที่ {pm.weekNo || "-"}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="box mt8">
                <div className="sectionBar cell">ส่วนโครงการ (PROJECT TEAM)</div>

                <table className="mainTable">
                  <colgroup>
                    <col style={{ width: "33.33%" }} />
                    <col style={{ width: "33.33%" }} />
                    <col style={{ width: "33.33%" }} />
                  </colgroup>

                  <tbody>
                    <tr>
                      <td className="cell top">
                        <div className="miniTitle">
                          ผู้รับเหมา
                          <div className="miniTitleEn">(CONTRACTORS)</div>
                        </div>

                        <table className="mini mt6">
                          <colgroup>
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "30%" }} />
                            <col style={{ width: "40%" }} />
                            <col style={{ width: "20%" }} />
                          </colgroup>

                          <thead>
                            <tr className="fixedRow">
                              <th>#</th>
                              <th>รายชื่อ</th>
                              <th>ตำแหน่ง</th>
                              <th>จำนวน</th>
                            </tr>
                          </thead>

                          <tbody>
                            {contractorsPadded.map((r, i) => (
                              <tr key={r.id} className="fixedRow">
                                <td className="c middle">{i + 1}</td>
                                <td className="middle wrapText">{r.name?.trim() ? r.name : "-"}</td>
                                <td className="middle wrapText">
                                  {r.position?.trim() ? r.position : "-"}
                                </td>
                                <td className="c numTab middle">{Number(r.qty) || 0}</td>
                              </tr>
                            ))}

                            <tr className="fixedRow">
                              <td className="c middle" />
                              <td colSpan={2} className="middle">
                                <span className="fw700">รวม</span>
                              </td>
                              <td className="c numTab middle">
                                <span className="fw700">{contractorTotal}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>

                      <td className="cell top">
                        <div className="miniTitle">
                          ผู้รับเหมารายย่อย
                          <div className="miniTitleEn">(SUB CONTRACTORS)</div>
                        </div>

                        <table className="mini mt6">
                          <colgroup>
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "36%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                          </colgroup>

                          <thead>
                            <tr className="fixedRow">
                              <th>#</th>
                              <th>ตำแหน่ง</th>
                              <th>เช้า</th>
                              <th>บ่าย</th>
                              <th>ล่วงเวลา</th>
                            </tr>
                          </thead>

                          <tbody>
                            {subPadded.map((r, i) => (
                              <tr key={r.id} className="fixedRow">
                                <td className="c middle">{i + 1}</td>
                                <td className="middle wrapText">
                                  {r.position?.trim() ? r.position : "-"}
                                </td>
                                <td className="c numTab middle">{Number(r.morning) || 0}</td>
                                <td className="c numTab middle">{Number(r.afternoon) || 0}</td>
                                <td className="c numTab middle">{Number(r.overtime) || 0}</td>
                              </tr>
                            ))}

                            <tr className="fixedRow">
                              <td className="c middle" />
                              <td className="middle">
                                <span className="fw700">รวม</span>
                              </td>
                              <td className="c numTab middle">
                                <span className="fw700">{subTotals.morning}</span>
                              </td>
                              <td className="c numTab middle">
                                <span className="fw700">{subTotals.afternoon}</span>
                              </td>
                              <td className="c numTab middle">
                                <span className="fw700">{subTotals.overtime}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>

                      <td className="cell top">
                        <div className="miniTitle">
                          เครื่องจักรหลัก
                          <div className="miniTitleEn">(MAJOR EQUIPMENT)</div>
                        </div>

                        <table className="mini mt6">
                          <colgroup>
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "36%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                          </colgroup>

                          <thead>
                            <tr className="fixedRow">
                              <th>#</th>
                              <th>ชนิด</th>
                              <th>เช้า</th>
                              <th>บ่าย</th>
                              <th>ล่วงเวลา</th>
                            </tr>
                          </thead>

                          <tbody>
                            {equipPadded.map((r, i) => (
                              <tr key={r.id} className="fixedRow">
                                <td className="c middle">{i + 1}</td>
                                <td className="middle wrapText">{r.type?.trim() ? r.type : "-"}</td>
                                <td className="c numTab middle">{Number(r.morning) || 0}</td>
                                <td className="c numTab middle">{Number(r.afternoon) || 0}</td>
                                <td className="c numTab middle">{Number(r.overtime) || 0}</td>
                              </tr>
                            ))}

                            <tr className="fixedRow">
                              <td className="c middle" />
                              <td className="middle">
                                <span className="fw700">รวม</span>
                              </td>
                              <td className="c numTab middle">
                                <span className="fw700">{equipTotals.morning}</span>
                              </td>
                              <td className="c numTab middle">
                                <span className="fw700">{equipTotals.afternoon}</span>
                              </td>
                              <td className="c numTab middle">
                                <span className="fw700">{equipTotals.overtime}</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="box mt8">
                <div className="sectionBar cell">ผลงานที่ดำเนินการ (WORK PERFORMED)</div>

                <table className="mainTable">
                  <colgroup>
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "34%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "20%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>#</th>
                      <th>รายการ (DESCRIPTION)</th>
                      <th>บริเวณ (LOCATIONS)</th>
                      <th>จำนวน</th>
                      <th>หน่วย</th>
                      <th>วัสดุนำเข้า (MATERIAL)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(model.workPerformed?.length
                      ? model.workPerformed
                      : [
                          {
                            id: "EMPTY-W",
                            desc: "-",
                            location: "-",
                            qty: "-",
                            unit: "-",
                            materialDelivered: "-",
                          },
                        ]
                    ).map((r, i) => (
                      <tr key={r.id}>
                        <td className="c">{i + 1}</td>
                        <td>{r.desc || "-"}</td>
                        <td>{r.location || "-"}</td>
                        <td className="c">{r.qty || "-"}</td>
                        <td className="c">{r.unit || "-"}</td>
                        <td>{r.materialDelivered || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasIssues && (
                <div className="box mt8">
                  <div className="sectionBar cell">ปัญหาและอุปสรรค</div>

                  {issuesList.map((it, idx) => (
                    <table key={it.id || idx} className="mainTable issueTable mt6">
                      <colgroup>
                        <col style={{ width: "30%" }} />
                        <col style={{ width: "35%" }} />
                        <col style={{ width: "35%" }} />
                      </colgroup>

                      <thead>
                        <tr>
                          <th>ภาพปัญหาและอุปสรรค</th>
                          <th>รายละเอียด</th>
                          <th>ความเห็นของผู้ควบคุมงาน</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td className="issueCell">
                            <div className="issueLabel">ปัญหาที่ {idx + 1}</div>
                            {it.imageUrl ? (
                              <div className="issueImageWrap">
                                <Image
                                  src={it.imageUrl}
                                  alt={`issue-${idx + 1}`}
                                  fill
                                  sizes="240px"
                                  style={{ objectFit: "contain" }}
                                />
                              </div>
                            ) : (
                              <div className="issueNoImage">-</div>
                            )}
                          </td>

                          <td className="issueCell">
                            <div className="issueLabel">ปัญหาที่ {idx + 1}</div>
                            <div className="preLine">{it.detail || " "}</div>
                          </td>

                          <td className="issueCell">
                            {renderIssueCommentCell ? (
                              renderIssueCommentCell(it, idx)
                            ) : (
                              <div className="commentList">
                                {(it.comments || []).length ? (
                                  (it.comments || []).map((c) => (
                                    <div key={c.id} className="commentItem">
                                      <div className="commentAuthor">
                                        {c.author?.name?.trim() ||
                                          c.author?.email?.trim() ||
                                          "-"}
                                      </div>
                                      <div className="preLine">{c.comment || " "}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="mutedDash"> </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ))}
                </div>
              )}

              <div className="box mt8">
                <div className="sectionBar cell">บันทึกด้านความปลอดภัยในการทำงาน</div>
                <div className="cell preLine minSafe">{model.safetyNote || " "}</div>
              </div>

              <div className="box mt8">
                <div className="sectionBar cell">รายชื่อผู้ควบคุมงาน</div>
                <div className="cell">
                  <SignatureGrid items={model.supervisors || []} />
                </div>
              </div>
            </div>

            <style jsx>{`
              .previewRoot {
                color: #111827;
                font-family: Arial, Helvetica, sans-serif;
              }

              .page {
                width: 794px;
                background: #ffffff;
                margin: 0 auto;
                padding: 16px;
                border: 1px solid #d1d5db;
                box-sizing: border-box;
              }

              .header {
                display: grid;
                grid-template-columns: 88px 1fr 160px;
                gap: 8px;
                align-items: center;
                margin-bottom: 8px;
              }

              .headerLeft,
              .headerCenter,
              .headerRight {
                min-height: 1px;
              }

              .logoBox {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 64px;
              }

              .titleTH {
                font-size: 20px;
                font-weight: 700;
                text-align: center;
                line-height: 1.2;
              }

              .titleEN {
                font-size: 12px;
                font-weight: 700;
                text-align: center;
                line-height: 1.2;
              }

              .projectName {
                margin-top: 4px;
                font-size: 15px;
                font-weight: 700;
                text-align: center;
              }

              .dateBox {
                border: 1px solid #111827;
                min-height: 64px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
              }

              .dateLabel {
                font-size: 12px;
                font-weight: 700;
              }

              .dateValue {
                margin-top: 4px;
                font-size: 14px;
              }

              .mainTable,
              .mini {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
              }

              .mainTable th,
              .mainTable td,
              .mini th,
              .mini td {
                border: 1px solid #111827;
                padding: 4px 6px;
                font-size: 11px;
                line-height: 1.2;
                vertical-align: top;
                box-sizing: border-box;
              }

              .mainTable th,
              .mini th {
                font-weight: 700;
                text-align: center;
              }

              .cell {
                padding: 6px;
              }

              .box {
                width: 100%;
              }

              .sectionBar {
                font-weight: 700;
                text-align: center;
                background: #f3f4f6;
              }

              .labelStrong {
                font-weight: 700;
              }

              .miniTitle {
                text-align: center;
                font-weight: 700;
                line-height: 1.2;
              }

              .miniTitleEn {
                font-size: 10px;
                font-weight: 700;
              }

              .mt6 {
                margin-top: 6px;
              }

              .mt8 {
                margin-top: 8px;
              }

              .w55 {
                width: 55%;
              }

              .w45 {
                width: 45%;
              }

              .w34 {
                width: 34%;
              }

              .w38 {
                width: 38%;
              }

              .w28 {
                width: 28%;
              }

              .c {
                text-align: center;
              }

              .top {
                vertical-align: top;
              }

              .middle {
                vertical-align: middle !important;
              }

              .wrapText {
                word-break: break-word;
                overflow-wrap: anywhere;
              }

              .numTab {
                font-variant-numeric: tabular-nums;
              }

              .fixedRow > td,
              .fixedRow > th {
                height: 40px;
              }

              .fw700 {
                font-weight: 700;
              }

              .issueTable {
                table-layout: fixed;
              }

              .issueCell {
                min-height: 180px;
              }

              .issueLabel {
                font-weight: 700;
                margin-bottom: 6px;
              }

              .issueImageWrap {
                position: relative;
                width: 100%;
                height: 180px;
              }

              .issueNoImage {
                width: 100%;
                height: 180px;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .commentList {
                display: flex;
                flex-direction: column;
                gap: 6px;
              }

              .commentItem {
                border-bottom: 1px dashed #cbd5e1;
                padding-bottom: 4px;
              }

              .commentItem:last-child {
                border-bottom: 0;
                padding-bottom: 0;
              }

              .commentAuthor {
                font-weight: 700;
                margin-bottom: 2px;
              }

              .mutedDash {
                min-height: 120px;
              }

              .preLine {
                white-space: pre-line;
                word-break: break-word;
                overflow-wrap: anywhere;
              }

              .minSafe {
                min-height: 64px;
              }

              .sigWrap {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding-top: 6px;
                padding-bottom: 6px;
              }

              .sigRow {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 12px;
              }

              .sigItem {
                min-height: 54px;
                text-align: center;
                font-size: 11px;
                line-height: 1.5;
              }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ReportPreviewForm = ReportPreviewReadonly;

export default ReportPreviewReadonly;