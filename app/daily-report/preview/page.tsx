// app/daily-report/preview/page.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ProjectMeta = {
  id: string;
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

  supervisors: string[];
};

type ContractorRow = { id: string; name: string; position: string; qty: number };
type SubContractorRow = { id: string; position: string; morning: number; afternoon: number; overtime: number };
type MajorEquipmentRow = { id: string; type: string; morning: number; afternoon: number; overtime: number };
type WorkRow = { id: string; desc: string; location: string; qty: string; unit: string; materialDelivered: string };
type IssueRow = { id: string; detail: string; imageDataUrl: string };

type DailyReportPayload = {
  projectId: string;
  projectMeta: ProjectMeta;

  date: string;
  tempMaxC: number | null;
  tempMinC: number | null;

  contractors: ContractorRow[];
  subContractors: SubContractorRow[];
  majorEquipment: MajorEquipmentRow[];

  workPerformed: WorkRow[];
  issues: IssueRow[];

  safetyNote: string;
};

function formatDateBE(yyyyMmDd?: string) {
  if (!yyyyMmDd) return "-";
  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return yyyyMmDd;
  const [yStr, mStr, dStr] = parts;

  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return `${dStr}/${mStr}/${yStr}`;
  const be = y + 543;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${dd}/${mm}/${be}`;
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

const A4_WIDTH_PX = 794; // ~210mm @96dpi

function computeScaleFromWidth(containerWidth: number) {
  const safeW = Math.max(0, containerWidth - 16); // กันชิดขอบ
  const s = Math.min(1, safeW / A4_WIDTH_PX);
  const ss = Number.isFinite(s) ? s : 1;
  const scaledW = Math.max(1, Math.floor(A4_WIDTH_PX * ss));
  return { ss, scaledW };
}

export default function PreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<DailyReportPayload | null>(null);

  const [tempMax, setTempMax] = useState<number | null>(null);
  const [tempMin, setTempMin] = useState<number | null>(null);
  const [wMorning, setWMorning] = useState<string>("-");
  const [wAfternoon, setWAfternoon] = useState<string>("-");
  const [wOvertime, setWOvertime] = useState<string>("-");
  const [wxLoading, setWxLoading] = useState(false);

  // ✅ init scale ตั้งแต่ก่อนวาด
  const init = useMemo(() => {
    if (typeof window === "undefined") return { ss: 1, scaledW: A4_WIDTH_PX };
    const w = window.innerWidth || A4_WIDTH_PX;
    return computeScaleFromWidth(w);
  }, []);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(init.ss);
  const [scaledWidth, setScaledWidth] = useState(init.scaledW);

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
    const raw = sessionStorage.getItem("dailyReportPayload");
    if (!raw) {
      setData(null);
      return;
    }
    try {
      setData(JSON.parse(raw));
    } catch {
      setData(null);
    }
  }, []);

  const project = useMemo(() => data?.projectMeta ?? null, [data]);

  const hasOvertime = useMemo(() => {
    if (!data) return false;
    const subOt = data.subContractors?.some((r) => (Number(r.overtime) || 0) > 0);
    const eqOt = data.majorEquipment?.some((r) => (Number(r.overtime) || 0) > 0);
    return Boolean(subOt || eqOt);
  }, [data]);

  const contractorTotal = useMemo(
    () => (data?.contractors || []).reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [data]
  );

  const subTotals = useMemo(() => {
    const list = data?.subContractors || [];
    return {
      morning: list.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: list.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: list.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [data]);

  const equipTotals = useMemo(() => {
    const list = data?.majorEquipment || [];
    return {
      morning: list.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: list.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: list.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [data]);

  const hasIssues = useMemo(() => {
    const list = data?.issues || [];
    return list.some((x) => (x.detail || "").trim() || (x.imageDataUrl || "").trim());
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!data?.date) return;

      setWxLoading(true);
      try {
        const hourly = await fetchHourlyWeather(data.date);

        const start = hmToMin("06:00");
        const end = hasOvertime ? hmToMin("24:00") : hmToMin("18:00");
        const { max, min } = calcMaxMinInRange(hourly, start, end);

        const mMorning = representativeWeather(hourly, hmToMin("08:30"), hmToMin("12:00"));
        const mAfternoon = representativeWeather(hourly, hmToMin("13:00"), hmToMin("16:30"));
        const mOvertime = hasOvertime ? representativeWeather(hourly, hmToMin("16:30"), hmToMin("24:00")) : "-";

        if (!cancelled) {
          setTempMax(max);
          setTempMin(min);
          setWMorning(mMorning);
          setWAfternoon(mAfternoon);
          setWOvertime(mOvertime);
        }
      } catch {
        if (!cancelled) {
          setTempMax(data.tempMaxC ?? null);
          setTempMin(data.tempMinC ?? null);
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
  }, [data?.date, hasOvertime, data?.tempMaxC, data?.tempMinC]);

  if (!data || !project) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-xl border bg-card p-4">
            <div className="font-semibold">ไม่พบข้อมูลสำหรับ Preview</div>
            <div className="text-sm opacity-70 mt-1">ให้กลับไปหน้า Daily report แล้วกด Submit ใหม่</div>
            <button className="mt-3 rounded-lg border px-4 py-2" onClick={() => router.push("/daily-report")}>
              กลับไปกรอกใหม่
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dailyNoText = project.dailyReportNo || "-";
  const periodNoText = project.periodNo || "-";
  const weekNoText = project.weekNo || "-";

  const maxRows = Math.max(
    data.contractors?.length || 0,
    data.subContractors?.length || 0,
    data.majorEquipment?.length || 0,
    1
  );

  const contractorsPadded = padArray<ContractorRow>(data.contractors || [], maxRows, (i) => ({
    id: `EMPTY-C-${i}`,
    name: "-",
    position: "-",
    qty: 0,
  }));

  const subPadded = padArray<SubContractorRow>(data.subContractors || [], maxRows, (i) => ({
    id: `EMPTY-S-${i}`,
    position: "-",
    morning: 0,
    afternoon: 0,
    overtime: 0,
  }));

  const equipPadded = padArray<MajorEquipmentRow>(data.majorEquipment || [], maxRows, (i) => ({
    id: `EMPTY-E-${i}`,
    type: "-",
    morning: 0,
    afternoon: 0,
    overtime: 0,
  }));

  const issuesList = (data.issues || []).filter((it) => (it.detail || "").trim() || (it.imageDataUrl || "").trim());

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ✅ ลด padding บนมือถือ เพื่อไม่ให้เหลือพื้นที่ว่างข้างล่างเยอะ */}
      <div className="mx-auto max-w-[1200px] px-3 md:px-6 py-2 md:py-4">
        {/* Top actions (ไม่พิมพ์) */}
        <div className="flex items-center justify-between mb-3 print:hidden">
          <button className="rounded-lg border px-3 py-2" onClick={() => router.push("/daily-report")}>
            ← กลับไปแก้ไข
          </button>

          <button
            className="rounded-lg border px-3 py-2"
            onClick={() => {
              sessionStorage.setItem("dailyReportPayload", JSON.stringify(data));
              router.push(hasIssues ? "/commentator" : "/summation");
            }}
          >
            ส่ง →
          </button>
        </div>

        <style>{`
          /* ---------- Document look ---------- */
          /* ✅ ทำให้ Preview อยู่กลางจริง (ไม่ติดขวา) */
          .previewWrap {
            width: 100%;
            display: flex;
            justify-content: center;
          }

          /* กล่องที่จองพื้นที่ตามสเกล */
          .previewSized {
            margin: 0;               /* ให้ flex คุมการจัดกลาง */
          }

          .previewScaled {
            transform-origin: top left;
            will-change: transform;
          }

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

          /* ✅ Mobile only */
          @media (max-width: 640px) {
            .a4 { font-size: 11px; padding: 10px; }
            .hMain { font-size: 15px; }
            .hSub { font-size: 11px; }
            .cell, .cellCenter { padding: 5px 6px; }
            .mini th, .mini td { font-size: 10px; padding: 3px 4px; }
            .nowrap { white-space: normal; }
          }

          /* ---------- Print ---------- */
          @media print {
            body { background: white; }
            .print\\:hidden { display: none !important; }

            body * { visibility: hidden !important; }
            #printArea, #printArea * { visibility: visible !important; }
            #printArea {
              position: absolute;
              left: 0;
              top: 0;
              width: 210mm;
            }

            .a4 { border: none; border-radius: 0; padding: 0; }
            @page { size: A4; margin: 10mm; }
          }
        `}</style>

        {/* ✅ Scale */}
        <div ref={wrapRef} className="previewWrap">
          <div className="previewSized" style={{ width: scaledWidth }}>
            <div
              className="previewScaled"
              style={{
                width: A4_WIDTH_PX,
                transform: `scale(${scale}) translateZ(0)`,
              }}
            >
              <div className="a4" id="printArea">
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
                          <div className="hMain">รายงานการควบคุมงานก่อสร้างประจำวัน (DAILY CONSTRUCTION REPORT)</div>
                          <div className="mt-1 hSub">ประจำวันที่ {formatDateBE(data.date)}</div>
                          <div className="mt-1 hSub">โครงการ : {project.projectName}</div>
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
                        <td className="cell">{project.contractNo}</td>
                        <td className="cell">สถานที่ก่อสร้าง</td>
                        <td className="cell">{project.siteLocation}</td>
                      </tr>
                      <tr>
                        <td className="cell">บันทึกแนบท้ายที่</td>
                        <td className="cell">{project.annexNo}</td>
                        <td className="cell">วงเงินค่าก่อสร้าง</td>
                        <td className="cell">{project.contractValue}</td>
                      </tr>
                      <tr>
                        <td className="cell">เริ่มสัญญา</td>
                        <td className="cell">{formatDateBE(project.contractStart)}</td>
                        <td className="cell">ผู้รับจ้าง</td>
                        <td className="cell">{project.contractorName}</td>
                      </tr>
                      <tr>
                        <td className="cell">สิ้นสุดสัญญา</td>
                        <td className="cell">{formatDateBE(project.contractEnd)}</td>
                        <td className="cell">จัดจ้างโดยวิธี</td>
                        <td className="cell">{project.procurementMethod}</td>
                      </tr>
                      <tr>
                        <td className="cell">จำนวนงวด</td>
                        <td className="cell">{project.installmentCount}</td>
                        <td className="cell">รวมเวลาก่อสร้าง</td>
                        <td className="cell">{project.totalDurationDays} วัน</td>
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
                          <div className="nowrap text-center">ช่วงบ่าย 13:00น.-16:30น.</div>
                          <div className="nowrap text-right">ล่วงเวลา 16:30น. ขึ้นไป</div>
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
                                  <span className="font-semibold">{contractorTotal}</span>
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
                                  <span className="font-semibold">{subTotals.morning}</span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">{subTotals.afternoon}</span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">{subTotals.overtime}</span>
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
                                  <span className="font-semibold">{equipTotals.morning}</span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">{equipTotals.afternoon}</span>
                                </td>
                                <td className="c numTab">
                                  <span className="font-semibold">{equipTotals.overtime}</span>
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
                      {data.workPerformed.map((r, i) => (
                        <tr key={r.id}>
                          <td className="cellCenter">{i + 1}</td>
                          <td className="cell">{r.desc}</td>
                          <td className="cell">{r.location}</td>
                          <td className="cellCenter">{r.qty}</td>
                          <td className="cellCenter">{r.unit}</td>
                          <td className="cell">{r.materialDelivered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ===================== ISSUES ===================== */}
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
                )}

                {/* ===================== SAFETY ===================== */}
                <div className="box mt-4">
                  <div className="subBar cell">บันทึกด้านความปลอดภัยในการทำงาน</div>
                  <div className="cell whitespace-pre-wrap min-h-[90px]">{data.safetyNote || " "}</div>
                </div>

                {/* ===================== SUPERVISORS ===================== */}
                <div className="box mt-4">
                  <div className="cell">
                    <div className="font-semibold">รายชื่อผู้ควบคุมงาน (กำหนดโดย Generator)</div>
                    <div className="mt-2">{project.supervisors?.length ? project.supervisors.join(" , ") : "-"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ เอา spacer ข้างล่างออก เพื่อไม่ให้เหลือพื้นที่ว่างเยอะ */}
        {/* <div className="h-6" /> */}
      </div>
    </div>
  );
}
