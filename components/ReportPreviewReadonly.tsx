// components/ReportPreviewReadonly.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Supervisor = { name: string; role: string };

type ContractorRow = { id: string; name: string; position: string; qty: number };
type SubContractorRow = { id: string; position: string; morning: number; afternoon: number; overtime: number };
type MajorEquipmentRow = { id: string; type: string; morning: number; afternoon: number; overtime: number };
type WorkRow = { id: string; desc: string; location: string; qty: string; unit: string; materialDelivered: string };
type IssueRow = { id: string; detail: string; imageDataUrl: string };

type ProjectMeta = {
  projectName?: string;
  contractNo?: string;
  annexNo?: string;
  contractStart?: string;
  contractEnd?: string;
  contractorName?: string;
  siteLocation?: string;
  contractValue?: string;
  procurementMethod?: string;
  installmentCount?: number;
  totalDurationDays?: number;

  dailyReportNo?: string;
  periodNo?: string;
  weekNo?: string;

  supervisors?: any[];
};

type DbReport = {
  id: string;
  projectId: string;
  date: string;
  projectName?: string;
  projectMeta?: ProjectMeta | null;

  // คาดหวังว่ามี ถ้า API คืนมาครบ (ถ้ายังไม่มีจะ fallback)
  contractors?: ContractorRow[];
  subContractors?: SubContractorRow[];
  majorEquipment?: MajorEquipmentRow[];
  workPerformed?: WorkRow[];
  safetyNote?: string;
  tempMaxC?: number | null;
  tempMinC?: number | null;

  // issues จาก DB: ใช้ imageUrl แล้ว map -> imageDataUrl
  issues?: { id: string; detail: string; imageUrl: string | null }[];
};

function formatDateBE(yyyyMmDdOrIso?: string) {
  if (!yyyyMmDdOrIso) return "-";

  // รองรับทั้ง "YYYY-MM-DD" และ ISO
  const tryISO = new Date(yyyyMmDdOrIso);
  if (!Number.isNaN(tryISO.getTime())) {
    const dd = String(tryISO.getDate()).padStart(2, "0");
    const mm = String(tryISO.getMonth() + 1).padStart(2, "0");
    const yyyy = tryISO.getFullYear() + 543;
    return `${dd}/${mm}/${yyyy}`;
  }

  const parts = yyyyMmDdOrIso.split("-");
  if (parts.length !== 3) return yyyyMmDdOrIso;
  const [yStr, mStr, dStr] = parts;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return `${dStr}/${mStr}/${yStr}`;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
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
    .map((x) => ({
      name: String(x?.name || "").trim(),
      role: String(x?.role || "").trim(),
    }))
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

function supervisorsFromMeta(meta: ProjectMeta | null | undefined): Supervisor[] {
  const raw = meta?.supervisors;
  if (!Array.isArray(raw)) return [];

  const looksLikeRole = (s: string) =>
    /(ผู้|หัวหน้า|ผอ|วิศวกร|ผู้ตรวจ|ผู้ออกแบบ|ผู้ควบคุม|ผู้แทน)/.test(s);

  return raw
    .map((x: any) => {
      if (x && typeof x === "object") {
        return { role: String(x?.role || "").trim(), name: String(x?.name || "").trim() };
      }
      const s = String(x || "").trim();
      if (!s) return { role: "", name: "" };
      return looksLikeRole(s) ? { role: s, name: "" } : { role: "", name: s };
    })
    .filter((it) => it.role || it.name);
}

export function ReportPreviewReadonly({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [report, setReport] = useState<DbReport | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  const init = useMemo(() => {
    if (typeof window === "undefined") return { ss: 1, scaledW: A4_WIDTH_PX };
    const w = window.innerWidth || A4_WIDTH_PX;
    return computeScaleFromWidth(w);
  }, []);

  const [scale, setScale] = useState(init.ss);
  const [scaledWidth, setScaledWidth] = useState(init.scaledW);

  const [tempMax, setTempMax] = useState<number | null>(null);
  const [tempMin, setTempMin] = useState<number | null>(null);
  const [wMorning, setWMorning] = useState<string>("-");
  const [wAfternoon, setWAfternoon] = useState<string>("-");
  const [wOvertime, setWOvertime] = useState<string>("-");
  const [wxLoading, setWxLoading] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;

    const updateFromEl = () => {
      const w = el?.getBoundingClientRect().width ?? window.innerWidth ?? A4_WIDTH_PX;
      const { ss, scaledW } = computeScaleFromWidth(w);
      setScale(ss);
      setScaledWidth(scaledW);
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

  useEffect(() => {
    let cancel = false;

    async function run() {
      setErr("");
      setReport(null);
      if (!reportId) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลดรายงานไม่สำเร็จ");

        const r: DbReport = json.report;

        if (!cancel) setReport(r);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? "โหลดรายงานไม่สำเร็จ");
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  const meta = report?.projectMeta ?? null;

  const supervisorsFinal = useMemo(() => supervisorsFromMeta(meta), [meta]);

  const contractors = report?.contractors ?? [];
  const subContractors = report?.subContractors ?? [];
  const majorEquipment = report?.majorEquipment ?? [];
  const workPerformed = report?.workPerformed ?? [];
  const safetyNote = report?.safetyNote ?? "";

  const issuesList: IssueRow[] = useMemo(() => {
    const list = report?.issues ?? [];
    return list
      .map((x) => ({
        id: String(x.id),
        detail: String(x.detail || ""),
        imageDataUrl: x.imageUrl ? String(x.imageUrl) : "",
      }))
      .filter((it) => (it.detail || "").trim() || (it.imageDataUrl || "").trim());
  }, [report]);

  const hasOvertime = useMemo(() => {
    const subOt = subContractors.some((r) => (Number(r.overtime) || 0) > 0);
    const eqOt = majorEquipment.some((r) => (Number(r.overtime) || 0) > 0);
    return Boolean(subOt || eqOt);
  }, [subContractors, majorEquipment]);

  useEffect(() => {
    let cancelled = false;

    async function runWeather() {
      if (!report?.date) return;

      setWxLoading(true);
      try {
        const dateOnly = String(report.date).slice(0, 10); // ISO -> YYYY-MM-DD
        const hourly = await fetchHourlyWeather(dateOnly);

        const start = hmToMin("06:00");
        const end = hasOvertime ? hmToMin("24:00") : hmToMin("18:00");
        const { max, min } = calcMaxMinInRange(hourly, start, end);

        const mMorning = representativeWeather(hourly, hmToMin("08:30"), hmToMin("12:00"));
        const mAfternoon = representativeWeather(hourly, hmToMin("13:00"), hmToMin("16:30"));
        const mOvertime = hasOvertime ? representativeWeather(hourly, hmToMin("16:30"), hmToMin("24:00")) : "-";

        if (!cancelled) {
          setTempMax(max ?? (report.tempMaxC ?? null));
          setTempMin(min ?? (report.tempMinC ?? null));
          setWMorning(mMorning);
          setWAfternoon(mAfternoon);
          setWOvertime(mOvertime);
        }
      } catch {
        if (!cancelled) {
          setTempMax(report.tempMaxC ?? null);
          setTempMin(report.tempMinC ?? null);
          setWMorning("-");
          setWAfternoon("-");
          setWOvertime("-");
        }
      } finally {
        if (!cancelled) setWxLoading(false);
      }
    }

    runWeather();
    return () => {
      cancelled = true;
    };
  }, [report?.date, hasOvertime, report?.tempMaxC, report?.tempMinC]);

  const projectName = meta?.projectName || report?.projectName || "-";

  const dailyNoText = meta?.dailyReportNo || "-";
  const periodNoText = meta?.periodNo || "-";
  const weekNoText = meta?.weekNo || "-";

  const maxRows = Math.max(contractors.length || 0, subContractors.length || 0, majorEquipment.length || 0, 1);

  const contractorsPadded = padArray<ContractorRow>(contractors, maxRows, (i) => ({
    id: `EMPTY-C-${i}`,
    name: "-",
    position: "-",
    qty: 0,
  }));

  const subPadded = padArray<SubContractorRow>(subContractors, maxRows, (i) => ({
    id: `EMPTY-S-${i}`,
    position: "-",
    morning: 0,
    afternoon: 0,
    overtime: 0,
  }));

  const equipPadded = padArray<MajorEquipmentRow>(majorEquipment, maxRows, (i) => ({
    id: `EMPTY-E-${i}`,
    type: "-",
    morning: 0,
    afternoon: 0,
    overtime: 0,
  }));

  if (!reportId) return null;

  return (
    <div className="mt-4 rounded-2xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold">แสดงฟอร์มรายงาน (เหมือนหน้า Preview)</div>
        <div className="text-sm opacity-70">
          {loading ? "กำลังโหลด..." : err ? "โหลดไม่สำเร็จ" : report ? `วันที่ ${formatDateBE(report.date)}` : ""}
        </div>
      </div>

      {err ? <div className="text-sm text-red-600 mb-3">{err}</div> : null}
      {loading ? <div className="opacity-70">กำลังโหลดข้อมูลรายงาน...</div> : null}
      {!loading && !report ? <div className="opacity-70">ยังไม่พบข้อมูลรายงาน</div> : null}

      <style>{`
        .previewWrap { width: 100%; display: flex; justify-content: center; }
        .previewSized { margin: 0; }
        .previewScaled { transform-origin: top left; will-change: transform; }

        .a4 {
          background: #fff;
          color: #111;
          border: 2px solid #111;
          border-radius: 14px;
          padding: 14px;
          font-size: 13px;
          line-height: 1.2;
        }

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

        .mini th, .mini td { border: 1.5px solid #111; padding: 4px 6px; font-size: 12px; line-height: 1.1; }
        .mini th { text-align: center; vertical-align: middle; font-weight: 700; }
        .mini td { vertical-align: top; }
        .mini .c { text-align: center; vertical-align: middle; }

        .numTab { font-variant-numeric: tabular-nums; }
        .nowrap { white-space: nowrap; }

        .issueImg { width: 100%; max-height: 240px; object-fit: contain; display: block; }
        .issueRowMin { min-height: 260px; }

        @media (max-width: 640px) {
          .a4 { font-size: 11px; padding: 10px; }
          .hMain { font-size: 15px; }
          .hSub { font-size: 11px; }
          .cell, .cellCenter { padding: 5px 6px; }
          .mini th, .mini td { font-size: 10px; padding: 3px 4px; }
          .nowrap { white-space: normal; }
        }
      `}</style>

      {report ? (
        <div ref={wrapRef} className="previewWrap">
          <div className="previewSized" style={{ width: scaledWidth }}>
            <div className="previewScaled" style={{ width: A4_WIDTH_PX, transform: `scale(${scale}) translateZ(0)` }}>
              <div className="a4">
                {/* ===================== Header ===================== */}
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
                            <Image
                              src="/logo.png"
                              alt="Company Logo"
                              width={110}
                              height={110}
                              className="w-full h-full object-contain"
                              priority
                            />
                          </div>
                        </td>

                        <td className="cellCenter titleBar">
                          <div className="hMain">รายงานการควบคุมงานก่อสร้างประจำวัน (DAILY REPORT)</div>
                          <div className="mt-1 hSub">ประจำวันที่ {formatDateBE(report.date)}</div>
                          <div className="mt-1 hSub">โครงการ : {projectName}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* รายละเอียดโครงการ */}
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
                        <td className="cell">{meta?.contractNo || "-"}</td>
                        <td className="cell">สถานที่ก่อสร้าง</td>
                        <td className="cell">{meta?.siteLocation || "-"}</td>
                      </tr>
                      <tr>
                        <td className="cell">บันทึกแนบท้ายที่</td>
                        <td className="cell">{meta?.annexNo || "-"}</td>
                        <td className="cell">วงเงินค่าก่อสร้าง</td>
                        <td className="cell">{meta?.contractValue || "-"}</td>
                      </tr>
                      <tr>
                        <td className="cell">เริ่มสัญญา</td>
                        <td className="cell">{formatDateBE(meta?.contractStart)}</td>
                        <td className="cell">ผู้รับจ้าง</td>
                        <td className="cell">{meta?.contractorName || "-"}</td>
                      </tr>
                      <tr>
                        <td className="cell">สิ้นสุดสัญญา</td>
                        <td className="cell">{formatDateBE(meta?.contractEnd)}</td>
                        <td className="cell">จัดจ้างโดยวิธี</td>
                        <td className="cell">{meta?.procurementMethod || "-"}</td>
                      </tr>
                      <tr>
                        <td className="cell">จำนวนงวด</td>
                        <td className="cell">{meta?.installmentCount ?? "-"}</td>
                        <td className="cell">รวมเวลาก่อสร้าง</td>
                        <td className="cell">{meta?.totalDurationDays ? `${meta.totalDurationDays} วัน` : "-"}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ช่วงเวลาทำงาน + กล่องเลขรายงาน */}
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
                      <div className="border-2 border-black bg-yellow-50 p-2 text-sm mb-2">{dailyNoText}</div>
                      <div className="border-2 border-black bg-yellow-50 p-2 text-sm mb-2">{periodNoText}</div>
                      <div className="border-2 border-black bg-yellow-50 p-2 text-sm">{weekNoText}</div>
                    </div>
                  </div>
                </div>

                {/* ===================== PROJECT TEAM ===================== */}
                <div className="box mt-4">
                  <div className="sectionBar cell">ส่วนโครงการ (PROJECT TEAM)</div>

                  <table>
                    <colgroup>
                      <col style={{ width: "33.33%" }} />
                      <col style={{ width: "33.33%" }} />
                      <col style={{ width: "33.33%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        {/* CONTRACTORS */}
                        <td className="cell">
                          <div className="font-semibold text-center leading-tight">
                            ผู้รับเหมา
                            <div className="text-xs font-semibold">(CONTRACTORS)</div>
                          </div>

                          <table className="mini mt-2">
                            <colgroup>
                              <col style={{ width: "12%" }} />
                              <col style={{ width: "44%" }} />
                              <col style={{ width: "24%" }} />
                              <col style={{ width: "20%" }} />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>รายชื่อ</th>
                                <th>ตำแหน่ง</th>
                                <th>จำนวน</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contractorsPadded.map((r, i) => (
                                <tr key={r.id}>
                                  <td className="c">{i + 1}</td>
                                  <td>{r.name?.trim() ? r.name : "-"}</td>
                                  <td>{r.position?.trim() ? r.position : "-"}</td>
                                  <td className="c numTab">{Number(r.qty) || 0}</td>
                                </tr>
                              ))}
                              <tr>
                                <td className="c" />
                                <td colSpan={2}>
                                  <span className="font-semibold">รวม</span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">
                                    {contractors.reduce((s, r) => s + (Number(r.qty) || 0), 0)}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>

                        {/* SUB CONTRACTORS */}
                        <td className="cell">
                          <div className="font-semibold text-center leading-tight">
                            ผู้รับเหมารายย่อย
                            <div className="text-xs font-semibold">(SUB CONTRACTORS)</div>
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
                              <tr>
                                <th>#</th>
                                <th>ตำแหน่ง</th>
                                <th>เช้า</th>
                                <th>บ่าย</th>
                                <th>ล่วงเวลา</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subPadded.map((r, i) => (
                                <tr key={r.id}>
                                  <td className="c">{i + 1}</td>
                                  <td>{r.position?.trim() ? r.position : "-"}</td>
                                  <td className="c numTab">{Number(r.morning) || 0}</td>
                                  <td className="c numTab">{Number(r.afternoon) || 0}</td>
                                  <td className="c numTab">{Number(r.overtime) || 0}</td>
                                </tr>
                              ))}
                              <tr>
                                <td className="c" />
                                <td>
                                  <span className="font-semibold">รวม</span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">
                                    {subContractors.reduce((s, r) => s + (Number(r.morning) || 0), 0)}
                                  </span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">
                                    {subContractors.reduce((s, r) => s + (Number(r.afternoon) || 0), 0)}
                                  </span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">
                                    {subContractors.reduce((s, r) => s + (Number(r.overtime) || 0), 0)}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>

                        {/* MAJOR EQUIPMENT */}
                        <td className="cell">
                          <div className="font-semibold text-center leading-tight">
                            เครื่องจักรหลัก
                            <div className="text-xs font-semibold">(MAJOR EQUIPMENT)</div>
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
                              <tr>
                                <th>#</th>
                                <th>ชนิด</th>
                                <th>เช้า</th>
                                <th>บ่าย</th>
                                <th>ล่วงเวลา</th>
                              </tr>
                            </thead>
                            <tbody>
                              {equipPadded.map((r, i) => (
                                <tr key={r.id}>
                                  <td className="c">{i + 1}</td>
                                  <td>{r.type?.trim() ? r.type : "-"}</td>
                                  <td className="c numTab">{Number(r.morning) || 0}</td>
                                  <td className="c numTab">{Number(r.afternoon) || 0}</td>
                                  <td className="c numTab">{Number(r.overtime) || 0}</td>
                                </tr>
                              ))}
                              <tr>
                                <td className="c" />
                                <td>
                                  <span className="font-semibold">รวม</span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">
                                    {majorEquipment.reduce((s, r) => s + (Number(r.morning) || 0), 0)}
                                  </span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">
                                    {majorEquipment.reduce((s, r) => s + (Number(r.afternoon) || 0), 0)}
                                  </span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">
                                    {majorEquipment.reduce((s, r) => s + (Number(r.overtime) || 0), 0)}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ===================== WORK PERFORMED ===================== */}
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
                      {(workPerformed.length ? workPerformed : [{ id: "EMPTY-W", desc: "-", location: "-", qty: "-", unit: "-", materialDelivered: "-" }]).map(
                        (r, i) => (
                          <tr key={r.id}>
                            <td className="cellCenter">{i + 1}</td>
                            <td className="cell">{r.desc}</td>
                            <td className="cell">{r.location}</td>
                            <td className="cellCenter">{r.qty}</td>
                            <td className="cellCenter">{r.unit}</td>
                            <td className="cell">{r.materialDelivered}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ===================== ISSUES ===================== */}
                {issuesList.length > 0 ? (
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
                              {it.imageDataUrl ? (
                                <img
                                  src={it.imageDataUrl}
                                  alt={`issue-img-${idx + 1}`}
                                  className="issueImg border border-black/30 rounded"
                                />
                              ) : (
                                <div className="text-sm opacity-60">-</div>
                              )}
                            </td>

                            <td className="cell issueRowMin">
                              <div className="text-sm font-semibold mb-2">ปัญหาที่ {idx + 1}</div>
                              <div className="text-sm whitespace-pre-wrap">{it.detail || " "}</div>
                            </td>

                            <td className="cell issueRowMin">
                              <div className="text-sm opacity-60"> </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {/* ===================== SAFETY ===================== */}
                <div className="box mt-4">
                  <div className="subBar cell">บันทึกด้านความปลอดภัยในการทำงาน</div>
                  <div className="cell whitespace-pre-wrap min-h-[90px]">{safetyNote || " "}</div>
                </div>

                {/* ===================== SUPERVISORS ===================== */}
                <div className="box mt-4">
                  <div className="cell">
                    <div className="font-semibold">รายชื่อผู้ควบคุมงาน</div>
                    <div className="mt-3">
                      <SignatureGrid items={supervisorsFinal} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
