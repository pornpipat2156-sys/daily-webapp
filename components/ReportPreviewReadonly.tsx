"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Supervisor = { name: string; role: string };

export type ContractorRow = { id: string; name: string; position: string; qty: number };
export type SubContractorRow = { id: string; position: string; morning: number; afternoon: number; overtime: number };
export type MajorEquipmentRow = { id: string; type: string; morning: number; afternoon: number; overtime: number };
export type WorkRow = { id: string; desc: string; location: string; qty: string; unit: string; materialDelivered: string };

export type IssueComment = {
  id: string;
  comment: string;
  createdAt: string;
  author?: { name?: string | null; email?: string | null; role?: string | null } | null;
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateBE(isoOrYmd?: string) {
  if (!isoOrYmd) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoOrYmd;
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

function SignatureGrid({ items }: { items: Supervisor[] }) {
  const clean = (items || [])
    .map((x) => ({ name: String(x?.name || "").trim(), role: String(x?.role || "").trim() }))
    .filter((x) => x.name || x.role);

  if (!clean.length) return <div className="opacity-70">-</div>;

  const rows = chunk(clean, 5);

  return (
    <div className="space-y-4">
      {rows.map((row, ri) => (
        <div key={ri} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
          {row.map((it, i) => (
            <div key={`${ri}-${i}`} className="text-center">
              <div className="text-sm">ลงชื่อ ................................</div>
              <div className="mt-1 text-sm">({it.name || "-"})</div>
              <div className="mt-1 text-sm">{it.role || " "}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function normStr(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isTemplatePlaceholder(value: string) {
  const s = String(value || "").trim();
  return s.includes("${") && s.includes("}");
}

function resolveAnnexDisplay(pm: ProjectMetaUnified) {
  const annexNo = String(pm.annexNo || "").trim();
  if (annexNo && !isTemplatePlaceholder(annexNo)) return annexNo;

  const dailyReportNo = String(pm.dailyReportNo || "").trim();
  if (dailyReportNo && !isTemplatePlaceholder(dailyReportNo)) return dailyReportNo;

  return annexNo || dailyReportNo || "-";
}

function normalizeModel(raw: any): ReportRenderModel {
  const pmRaw = raw?.projectMeta ?? raw?.project_meta ?? raw?.meta ?? {};
  const pm: ProjectMetaUnified = {
    projectName: String(pmRaw?.projectName ?? raw?.projectName ?? "-"),
    contractNo: String(pmRaw?.contractNo ?? "-"),
    annexNo: String(pmRaw?.annexNo ?? "-"),
    contractStart: String(pmRaw?.contractStart ?? "-"),
    contractEnd: String(pmRaw?.contractEnd ?? "-"),
    contractorName: String(pmRaw?.contractorName ?? "-"),
    siteLocation: String(pmRaw?.siteLocation ?? "-"),
    contractValue: String(pmRaw?.contractValue ?? "-"),
    procurementMethod: String(pmRaw?.procurementMethod ?? "-"),
    installmentCount: Number(pmRaw?.installmentCount ?? 0),
    totalDurationDays: Number(pmRaw?.totalDurationDays ?? 0),
    dailyReportNo: String(pmRaw?.dailyReportNo ?? "-"),
    periodNo: String(pmRaw?.periodNo ?? "-"),
    weekNo: String(pmRaw?.weekNo ?? "-"),
  };

  const safeArr = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);

  return {
    date: String(raw?.date ?? raw?.reportDate ?? "-"),
    projectName: String(raw?.projectName ?? pm.projectName ?? "-"),
    projectMeta: pm,
    contractors: safeArr<ContractorRow>(raw?.contractors).map((x: any, i) => ({
      id: String(x?.id ?? `C-${i}`),
      name: String(x?.name ?? "-"),
      position: String(x?.position ?? "-"),
      qty: Number(x?.qty ?? 0),
    })),
    subContractors: safeArr<SubContractorRow>(raw?.subContractors ?? raw?.sub_contractors).map((x: any, i) => ({
      id: String(x?.id ?? `S-${i}`),
      position: String(x?.position ?? "-"),
      morning: Number(x?.morning ?? 0),
      afternoon: Number(x?.afternoon ?? 0),
      overtime: Number(x?.overtime ?? 0),
    })),
    majorEquipment: safeArr<MajorEquipmentRow>(raw?.majorEquipment ?? raw?.major_equipment).map((x: any, i) => ({
      id: String(x?.id ?? `E-${i}`),
      type: String(x?.type ?? "-"),
      morning: Number(x?.morning ?? 0),
      afternoon: Number(x?.afternoon ?? 0),
      overtime: Number(x?.overtime ?? 0),
    })),
    workPerformed: safeArr<WorkRow>(raw?.workPerformed ?? raw?.work_performed).map((x: any, i) => ({
      id: String(x?.id ?? `W-${i}`),
      desc: String(x?.desc ?? "-"),
      location: String(x?.location ?? "-"),
      qty: String(x?.qty ?? "-"),
      unit: String(x?.unit ?? "-"),
      materialDelivered: String(x?.materialDelivered ?? x?.material ?? "-"),
    })),
    issues: safeArr<IssueRowUnified>(raw?.issues).map((x: any, i) => ({
      id: String(x?.id ?? `I-${i}`),
      detail: String(x?.detail ?? ""),
      imageUrl: String(x?.imageUrl ?? x?.image_url ?? ""),
      comments: safeArr<IssueComment>(x?.comments).map((c: any, ci) => ({
        id: String(c?.id ?? `IC-${i}-${ci}`),
        comment: String(c?.comment ?? ""),
        createdAt: String(c?.createdAt ?? new Date().toISOString()),
        author: c?.author
          ? { name: c.author?.name ?? null, email: c.author?.email ?? null, role: c.author?.role ?? null }
          : null,
      })),
    })),
    safetyNote: String(raw?.safetyNote ?? raw?.safety_note ?? ""),
    tempMaxC: raw?.tempMaxC ?? raw?.temp_max_c ?? null,
    tempMinC: raw?.tempMinC ?? raw?.temp_min_c ?? null,
    hasOvertime: raw?.hasOvertime ?? null,
    supervisors: safeArr<Supervisor>(raw?.supervisors).map((s: any) => ({
      name: String(s?.name ?? "-"),
      role: String(s?.role ?? "-"),
    })),
  };
}

export function ReportPreviewForm({
  model,
  renderIssueCommentCell,
}: {
  model: ReportRenderModel;
  renderIssueCommentCell?: (issue: IssueRowUnified, idx: number) => ReactNode;
}) {
  const init = useMemo(() => {
    if (typeof window === "undefined") return { ss: 1, scaledW: A4_WIDTH_PX };
    const w = window.innerWidth || A4_WIDTH_PX;
    return computeScaleFromWidth(w);
  }, []);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scaledRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(init.ss);
  const [scaledWidth, setScaledWidth] = useState(init.scaledW);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;

    const updateFromEl = () => {
      const w = el?.getBoundingClientRect().width ?? window.innerWidth ?? A4_WIDTH_PX;
      const { ss, scaledW } = computeScaleFromWidth(w);
      const mobile = w <= 640;

      setScale(ss);
      setScaledWidth(scaledW);
      setIsMobilePreview(mobile);

      const contentHeight = scaledRef.current?.offsetHeight ?? 0;
      if (mobile && contentHeight > 0) {
        setScaledHeight(Math.ceil(contentHeight * ss));
      } else {
        setScaledHeight(null);
      }
    };

    updateFromEl();

    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateFromEl());
      ro.observe(el);
    }

    const onResize = () => updateFromEl();
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize, { passive: true });

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const hasOvertime = useMemo(() => {
    if (model.hasOvertime != null) return Boolean(model.hasOvertime);
    const subOt = model.subContractors?.some((r) => (Number(r.overtime) || 0) > 0);
    const eqOt = model.majorEquipment?.some((r) => (Number(r.overtime) || 0) > 0);
    return Boolean(subOt || eqOt);
  }, [model]);

  const [tempMax, setTempMax] = useState<number | null>(model.tempMaxC ?? null);
  const [tempMin, setTempMin] = useState<number | null>(model.tempMinC ?? null);
  const [wMorning, setWMorning] = useState<string>("-");
  const [wAfternoon, setWAfternoon] = useState<string>("-");
  const [wOvertime, setWOvertime] = useState<string>("-");
  const [wxLoading, setWxLoading] = useState(false);

  const dateISO = useMemo(() => {
    const d = model.date || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return "";
    const y = dd.getFullYear();
    const m = pad2(dd.getMonth() + 1);
    const da = pad2(dd.getDate());
    return `${y}-${m}-${da}`;
  }, [model.date]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!dateISO) return;

      setWxLoading(true);
      try {
        const hourly = await fetchHourlyWeather(dateISO);

        const start = hmToMin("06:00");
        const end = hasOvertime ? hmToMin("24:00") : hmToMin("18:00");
        const { max, min } = calcMaxMinInRange(hourly, start, end);

        const mMorning = representativeWeather(hourly, hmToMin("08:30"), hmToMin("12:00"));
        const mAfternoon = representativeWeather(hourly, hmToMin("13:00"), hmToMin("16:30"));
        const mOver = hasOvertime ? representativeWeather(hourly, hmToMin("16:30"), hmToMin("24:00")) : "-";

        if (!cancelled) {
          setTempMax(max);
          setTempMin(min);
          setWMorning(mMorning);
          setWAfternoon(mAfternoon);
          setWOvertime(mOver);
        }
      } catch {
        if (!cancelled) {
          setTempMax(model.tempMaxC ?? null);
          setTempMin(model.tempMinC ?? null);
          setWMorning("-");
          setWAfternoon("-");
          setWOvertime("-");
        }
      } finally {
        if (!cancelled) setWxLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [dateISO, hasOvertime, model.tempMaxC, model.tempMinC]);

  const contractorTotal = useMemo(
    () => (model.contractors || []).reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [model]
  );
  const subTotals = useMemo(() => {
    const list = model.subContractors || [];
    return {
      morning: list.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: list.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: list.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [model]);
  const equipTotals = useMemo(() => {
    const list = model.majorEquipment || [];
    return {
      morning: list.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: list.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: list.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [model]);

  const maxRows = Math.max(model.contractors?.length || 0, model.subContractors?.length || 0, model.majorEquipment?.length || 0, 1);

  const contractorsPadded = useMemo(
    () =>
      padArray<ContractorRow>(model.contractors || [], maxRows, (i) => ({
        id: `EMPTY-C-${i}`,
        name: "-",
        position: "-",
        qty: 0,
      })),
    [model, maxRows]
  );

  const subPadded = useMemo(
    () =>
      padArray<SubContractorRow>(model.subContractors || [], maxRows, (i) => ({
        id: `EMPTY-S-${i}`,
        position: "-",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [model, maxRows]
  );

  const equipPadded = useMemo(
    () =>
      padArray<MajorEquipmentRow>(model.majorEquipment || [], maxRows, (i) => ({
        id: `EMPTY-E-${i}`,
        type: "-",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [model, maxRows]
  );

  const issuesList = useMemo(() => {
    const list = model.issues || [];
    return list.filter((it: any) => {
      const detail = String(it?.detail || "");
      const imageUrl = String(it?.imageUrl || "");

      const dNorm = normStr(detail);
      const isHistoryDeleted =
        dNorm.includes("รายการนี้ถูกลบ") ||
        dNorm.includes("ถูกลบ/แก้ไข") ||
        dNorm.includes("deleted/edited") ||
        dNorm.includes("deleted") ||
        Boolean(it?.isDeleted) ||
        Boolean(it?.deletedAt);

      if (isHistoryDeleted) return false;
      return detail.trim() || imageUrl.trim();
    });
  }, [model]);

  const hasIssues = issuesList.length > 0;
  const pm = model.projectMeta;
  const annexDisplay = resolveAnnexDisplay(pm);

  return (
    <>
      <style>{`
        .previewWrap { width: 100%; display: flex; justify-content: center; }
        .previewSized { margin: 0; }
        .previewScaled { transform-origin: top left; will-change: transform; }
        .a4 { background: #fff; color: #111; border: 2px solid #111; border-radius: 14px; padding: 14px; font-size: 13px; line-height: 1.2; }
        .box { border: 2px solid #111; border-radius: 12px; overflow: hidden; }
        .cell { border: 1.5px solid #111; padding: 6px 8px; vertical-align: top; }
        .cellCenter { border: 1.5px solid #111; padding: 6px 8px; text-align: center; vertical-align: middle; }
        .titleBar { background: #eadcf6; font-weight: 700; }
        .sectionBar { background: #dff2df; font-weight: 700; text-align: center; }
        .subBar { background: #f4e8d4; font-weight: 700; text-align: center; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { overflow-wrap: break-word; word-break: normal; }
        .hMain { font-weight: 800; font-size: 18px; letter-spacing: 0.2px; }
        .hSub  { font-weight: 600; font-size: 13px; }
        .mini th, .mini td { border: 1.5px solid #111; padding: 4px 6px; font-size: 10px; line-height: 1.0; }
        .mini th { text-align: center; vertical-align: middle; font-weight: 700; }
        .mini td { vertical-align: top; }
        .mini .c { text-align: center; vertical-align: middle; }
        .miniFixedRow > th, .miniFixedRow > td { height: 40px; vertical-align: middle; }
        .wrapText { word-break: break-word; overflow-wrap: anywhere; }
        .numTab { font-variant-numeric: tabular-nums; }
        .nowrap { white-space: nowrap; }
        .issueImg { width: 100%; max-height: 240px; object-fit: contain; display: block; }
        .issueRowMin { min-height: 260px; }
        @media (max-width: 640px) {
          .a4 { font-size: 11px; padding: 10px; }
          .hMain { font-size: 15px; }
          .hSub { font-size: 11px; }
          .cell, .cellCenter { padding: 5px 6px; }
          .mini th, .mini td { font-size: 9px; padding: 3px 4px; }
          .nowrap { white-space: normal; }
          .miniFixedRow > th, .miniFixedRow > td { height: 34px; }
        }
      `}</style>

      <div ref={wrapRef} className="previewWrap">
        <div
          className="previewSized"
          style={{
            width: scaledWidth,
            height: isMobilePreview && scaledHeight ? scaledHeight : undefined,
          }}
        >
          <div
            ref={scaledRef}
            className="previewScaled"
            style={{ width: A4_WIDTH_PX, transform: `scale(${scale}) translateZ(0)` }}
          >
            <div className="a4">
              <div className="box">
                <table>
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "82%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="cellCenter">
                        <div className="mx-auto w-[110px] h-[110px] rounded-full border-2 border-black overflow-hidden flex items-center justify-center bg-white">
                          <Image src="/logo.png" alt="Company Logo" width={110} height={110} className="w-full h-full object-contain" priority />
                        </div>
                      </td>
                      <td className="cellCenter titleBar">
                        <div className="hMain">รายงานการควบคุมงานก่อสร้างประจำวัน (DAILY REPORT)</div>
                        <div className="mt-1 hSub">ประจำวันที่ {formatDateBE(model.date)}</div>
                        <div className="mt-1 hSub">โครงการ : {model.projectName}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table>
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "32%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "32%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="cell">สัญญาจ้าง</td>
                      <td className="cell">{pm.contractNo}</td>
                      <td className="cell">สถานที่ก่อสร้าง</td>
                      <td className="cell">{pm.siteLocation}</td>
                    </tr>
                    <tr>
                      <td className="cell">บันทึกแนบท้ายที่</td>
                      <td className="cell">{annexDisplay}</td>
                      <td className="cell">วงเงินค่าก่อสร้าง</td>
                      <td className="cell">{pm.contractValue}</td>
                    </tr>
                    <tr>
                      <td className="cell">เริ่มสัญญา</td>
                      <td className="cell">{formatDateBE(pm.contractStart)}</td>
                      <td className="cell">ผู้รับจ้าง</td>
                      <td className="cell">{pm.contractorName}</td>
                    </tr>
                    <tr>
                      <td className="cell">สิ้นสุดสัญญา</td>
                      <td className="cell">{formatDateBE(pm.contractEnd)}</td>
                      <td className="cell">จัดจ้างโดยวิธี</td>
                      <td className="cell">{pm.procurementMethod}</td>
                    </tr>
                    <tr>
                      <td className="cell">จำนวนงวด</td>
                      <td className="cell">{pm.installmentCount}</td>
                      <td className="cell">รวมเวลาก่อสร้าง</td>
                      <td className="cell">{pm.totalDurationDays} วัน</td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-12">
                  <div className="col-span-9 border-t-2 border-black p-2">
                    <div className="border-2 border-black bg-yellow-50 p-2 text-sm">
                      <div className="font-semibold mb-1">ช่วงเวลาทำงาน</div>
                      <div className="grid grid-cols-3 gap-x-10 numTab">
                        <div className="nowrap">ช่วงเช้า 08:30น.-12:00น.</div>
                        <div className="nowrap text-center">ช่วงบ่าย 13:00น.-17:00น.</div>
                        <div className="nowrap text-right">ล่วงเวลา 17:00น. ขึ้นไป</div>
                      </div>

                      <div className="mt-2 font-semibold">สภาพอากาศ (WEATHER)</div>

                      {wxLoading ? (
                        <div className="opacity-70">กำลังดึงข้อมูลอุณหภูมิ/สภาพอากาศ...</div>
                      ) : (
                        <>
                          <div className="numTab">
                            <span className="nowrap">อุณหภูมิ สูงสุด: {tempMax ?? "-"}°C</span>
                            <span className="mx-6"> </span>
                            <span className="nowrap">อุณหภูมิ ต่ำสุด: {tempMin ?? "-"}°C</span>
                          </div>
                          <div className="grid grid-cols-3 gap-x-10 numTab mt-1">
                            <div className="nowrap">เช้า: {wMorning}</div>
                            <div className="nowrap text-center">บ่าย: {wAfternoon}</div>
                            <div className="nowrap text-right">ล่วงเวลา: {wOvertime}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="col-span-3 border-t-2 border-l-2 border-black p-2">
                    <div className="border-2 border-black bg-yellow-50 p-2 text-sm mb-2">{pm.dailyReportNo}</div>
                    <div className="border-2 border-black bg-yellow-50 p-2 text-sm mb-2">{pm.periodNo}</div>
                    <div className="border-2 border-black bg-yellow-50 p-2 text-sm">{pm.weekNo}</div>
                  </div>
                </div>
              </div>

              <div className="box mt-4">
                <div className="sectionBar cell">ส่วนโครงการ (PROJECT TEAM)</div>
                <table>
                  <colgroup>
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "30%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="cell">
                        <div className="font-semibold text-center leading-tight">
                          ผู้รับเหมา<div className="text-xs font-semibold">(CONTRACTORS)</div>
                        </div>
                        <table className="mini mt-2">
                          <colgroup>
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "45%" }} />
                            <col style={{ width: "30%" }} />
                            <col style={{ width: "15%" }} />
                          </colgroup>
                          <thead>
                            <tr className="miniFixedRow"><th>#</th><th className="nowrap">รายชื่อ</th><th>ตำแหน่ง</th><th>จำนวน</th></tr>
                          </thead>
                          <tbody>
                            {contractorsPadded.map((r, i) => (
                              <tr key={r.id} className="miniFixedRow">
                                <td className="c">{i + 1}</td>
                                <td className="nowrap">{r.name?.trim() ? r.name : "-"}</td>
                                <td className="wrapText">{r.position?.trim() ? r.position : "-"}</td>
                                <td className="c numTab">{Number(r.qty) || 0}</td>
                              </tr>
                            ))}
                            <tr className="miniFixedRow">
                              <td className="c" />
                              <td colSpan={2}><span className="font-semibold">รวม</span></td>
                              <td className="c numTab"><span className="font-semibold">{contractorTotal}</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>

                      <td className="cell">
                        <div className="font-semibold text-center leading-tight">
                          ผู้รับเหมารายย่อย<div className="text-xs font-semibold">(SUB CONTRACTORS)</div>
                        </div>
                        <table className="mini mt-2">
                          <colgroup>
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "36%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                          </colgroup>
                          <thead>
                            <tr className="miniFixedRow"><th>#</th><th>ตำแหน่ง</th><th>เช้า</th><th>บ่าย</th><th>ล่วงเวลา</th></tr>
                          </thead>
                          <tbody>
                            {subPadded.map((r, i) => (
                              <tr key={r.id} className="miniFixedRow">
                                <td className="c">{i + 1}</td>
                                <td className="wrapText">{r.position?.trim() ? r.position : "-"}</td>
                                <td className="c numTab">{Number(r.morning) || 0}</td>
                                <td className="c numTab">{Number(r.afternoon) || 0}</td>
                                <td className="c numTab">{Number(r.overtime) || 0}</td>
                              </tr>
                            ))}
                            <tr className="miniFixedRow">
                              <td className="c" />
                              <td><span className="font-semibold">รวม</span></td>
                              <td className="c numTab"><span className="font-semibold">{subTotals.morning}</span></td>
                              <td className="c numTab"><span className="font-semibold">{subTotals.afternoon}</span></td>
                              <td className="c numTab"><span className="font-semibold">{subTotals.overtime}</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>

                      <td className="cell">
                        <div className="font-semibold text-center leading-tight">
                          เครื่องจักรหลัก<div className="text-xs font-semibold">(MAJOR EQUIPMENT)</div>
                        </div>
                        <table className="mini mt-2">
                          <colgroup>
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "36%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "18%" }} />
                          </colgroup>
                          <thead>
                            <tr className="miniFixedRow"><th>#</th><th>ชนิด</th><th>เช้า</th><th>บ่าย</th><th>ล่วงเวลา</th></tr>
                          </thead>
                          <tbody>
                            {equipPadded.map((r, i) => (
                              <tr key={r.id} className="miniFixedRow">
                                <td className="c">{i + 1}</td>
                                <td className="wrapText">{r.type?.trim() ? r.type : "-"}</td>
                                <td className="c numTab">{Number(r.morning) || 0}</td>
                                <td className="c numTab">{Number(r.afternoon) || 0}</td>
                                <td className="c numTab">{Number(r.overtime) || 0}</td>
                              </tr>
                            ))}
                            <tr className="miniFixedRow">
                              <td className="c" />
                              <td><span className="font-semibold">รวม</span></td>
                              <td className="c numTab"><span className="font-semibold">{equipTotals.morning}</span></td>
                              <td className="c numTab"><span className="font-semibold">{equipTotals.afternoon}</span></td>
                              <td className="c numTab"><span className="font-semibold">{equipTotals.overtime}</span></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="box mt-4">
                <div className="subBar cell">รายละเอียดของงานที่ได้ดำเนินงานทำแล้ว (WORK PERFORMED)</div>
                <table>
                  <colgroup>
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "22%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="cellCenter">#</th>
                      <th className="cellCenter">รายการ (DESCRIPTION)</th>
                      <th className="cellCenter">บริเวณ (LOCATIONS)</th>
                      <th className="cellCenter">จำนวน</th>
                      <th className="cellCenter">หน่วย</th>
                      <th className="cellCenter">วัสดุนำเข้า (MATERIAL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(model.workPerformed?.length
                      ? model.workPerformed
                      : [{ id: "EMPTY-W", desc: "-", location: "-", qty: "-", unit: "-", materialDelivered: "-" }]
                    ).map((r, i) => (
                      <tr key={r.id}>
                        <td className="cellCenter">{i + 1}</td>
                        <td className="cell">{r.desc || "-"}</td>
                        <td className="cell">{r.location || "-"}</td>
                        <td className="cellCenter">{r.qty || "-"}</td>
                        <td className="cellCenter">{r.unit || "-"}</td>
                        <td className="cell">{r.materialDelivered || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasIssues && (
                <div className="box mt-4">
                  <table>
                    <colgroup>
                      <col style={{ width: "45%" }} />
                      <col style={{ width: "33%" }} />
                      <col style={{ width: "22%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="cellCenter titleBar">ภาพปัญหาและอุปสรรค</th>
                        <th className="cellCenter titleBar">รายละเอียด</th>
                        <th className="cellCenter titleBar">ความเห็นของผู้ควบคุมงาน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issuesList.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="cell issueRowMin">
                            <div className="text-sm font-semibold mb-2">ปัญหาที่ {idx + 1}</div>
                            {it.imageUrl ? (
                              <img src={it.imageUrl} alt={`issue-img-${idx + 1}`} className="issueImg border border-black/30 rounded" />
                            ) : (
                              <div className="text-sm opacity-60">-</div>
                            )}
                          </td>
                          <td className="cell issueRowMin">
                            <div className="text-sm font-semibold mb-2">ปัญหาที่ {idx + 1}</div>
                            <div className="text-sm whitespace-pre-wrap">{it.detail || " "}</div>
                          </td>
                          <td className="cell issueRowMin">
                            {renderIssueCommentCell ? renderIssueCommentCell(it, idx) : <div className="text-sm opacity-60"> </div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="box mt-4">
                <div className="subBar cell">บันทึกด้านความปลอดภัยในการทำงาน</div>
                <div className="cell whitespace-pre-wrap min-h-[90px]">{model.safetyNote || " "}</div>
              </div>

              <div className="box mt-4">
                <div className="cell">
                  <div className="font-semibold">รายชื่อผู้ควบคุมงาน</div>
                  <div className="mt-3">
                    <SignatureGrid items={model.supervisors} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** ===== Readonly wrapper for Contact chat ===== */
async function jgetText(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `GET ${url} failed`);
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(txt || `GET ${url} invalid json`);
  }
}

export function ReportPreviewReadonly({ reportId }: { reportId: string }) {
  const [model, setModel] = useState<ReportRenderModel | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr(null);
        setModel(null);

        const raw = await jgetText(`/api/daily-reports/${encodeURIComponent(reportId)}?mode=render`);
        const normalized = normalizeModel(raw);

        if (!cancelled) setModel(normalized);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        Preview โหลดไม่สำเร็จ: {err}
      </div>
    );
  }
  if (!model) {
    return <div className="text-sm text-gray-500">กำลังโหลด Preview...</div>;
  }
  return <ReportPreviewForm model={model} />;
}

export default ReportPreviewReadonly;