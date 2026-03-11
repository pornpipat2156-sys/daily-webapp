"use client";

import Image from "next/image";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type WeeklyProjectSummary = {
  projectName: string;
  contractNo: string;
  installmentLabel: string;
  contractorName: string;
  siteLocation: string;
  contractStart: string;
  contractEnd: string;
  contractValue: string;
  procurementMethod?: string;
  periodNo?: string;
};

export type WeeklyTimeSummary = {
  contractDays: number;
  previousUsedDays: number;
  currentWeekDays: number;
  accumulatedDays: number;
  remainingDays: number;
  plannedDays?: number | null;
  varianceDays?: number | null;
};

export type WeeklyWorkItem = {
  id: string;
  description: string;
  qty?: number | null;
  unit?: string | null;
  location?: string | null;
  remark?: string | null;
};

export type WeeklyProblemItem = {
  id: string;
  topic: string;
  impact?: string | null;
  solution?: string | null;
};

export type WeeklySafetySummary = {
  note: string;
  accidentCount?: number | null;
  injuredCount?: number | null;
  lostTimeCount?: number | null;
};

export type WeeklyProgressItem = {
  id: string;
  category: string;
  weightPercent: number;
  previousPercent: number;
  weeklyPercent: number;
  accumulatedPercent: number;
  remainingPercent: number;
  variancePercent?: number | null;
  plannedPercent?: number | null;
  amountTotal?: number | null;
  amountAccumulated?: number | null;
  amountRemaining?: number | null;
};

export type WeeklySupervisor = {
  name: string;
  role: string;
};

export type WeeklyReportModel = {
  id: string;
  projectId: string;
  year: number;
  weekNo: number;
  startDate: string;
  endDate: string;
  title: string;
  summary: WeeklyProjectSummary;
  timeSummary: WeeklyTimeSummary;
  workPerformedWeekly: WeeklyWorkItem[];
  comments: string;
  problemsAndObstacles: WeeklyProblemItem[];
  safety: WeeklySafetySummary;
  progressByCategory: WeeklyProgressItem[];
  supervisors: WeeklySupervisor[];
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  model: WeeklyReportModel | null;
  loading?: boolean;
  error?: string;
};

const A4_WIDTH = 794;
const A4_MIN_HEIGHT = 1123;
const PREVIEW_PADDING = 16;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateThai(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDateBE(input?: string | null) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
}

function formatNumber(value?: number | null, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatInteger(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", {
    maximumFractionDigits: 0,
  });
}

function textOrDash(value?: string | null) {
  const v = String(value ?? "").trim();
  return v || "-";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function SignatureGrid({ items }: { items: WeeklySupervisor[] }) {
  const clean = (items || []).filter((x) => x?.name?.trim() || x?.role?.trim());
  const rows = chunk(clean, 3);

  if (!rows.length) {
    return (
      <table>
        <tbody>
          <tr>
            <td className="cellCenter">ยังไม่มีข้อมูลผู้ลงนาม</td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, ri) => (
        <table key={ri}>
          <tbody>
            <tr>
              {row.map((it, i) => (
                <td
                  key={`${it.name}-${it.role}-${i}`}
                  className="cellCenter"
                  style={{ width: `${100 / row.length}%` }}
                >
                  <div
                    style={{
                      minHeight: 72,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div>ลงชื่อ ................................</div>
                    <div className="mt-2">({it.name || "-"})</div>
                    <div className="mt-1">{it.role || " "}</div>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}

export function WeeklyReportForm({ model, loading, error }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const scaledRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const [frameWidth, setFrameWidth] = useState(A4_WIDTH);
  const [frameHeight, setFrameHeight] = useState(A4_MIN_HEIGHT);

  const totalWeight =
    model?.progressByCategory?.reduce(
      (sum, item) => sum + Number(item.weightPercent || 0),
      0
    ) ?? 0;
  const totalPrev =
    model?.progressByCategory?.reduce(
      (sum, item) => sum + Number(item.previousPercent || 0),
      0
    ) ?? 0;
  const totalWeekly =
    model?.progressByCategory?.reduce(
      (sum, item) => sum + Number(item.weeklyPercent || 0),
      0
    ) ?? 0;
  const totalAccum =
    model?.progressByCategory?.reduce(
      (sum, item) => sum + Number(item.accumulatedPercent || 0),
      0
    ) ?? 0;
  const totalRemain =
    model?.progressByCategory?.reduce(
      (sum, item) => sum + Number(item.remainingPercent || 0),
      0
    ) ?? 0;

  const updateScale = useMemo(
    () => () => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const available = Math.max(280, wrap.clientWidth - PREVIEW_PADDING * 2);
      const nextScale = Math.min(1, available / A4_WIDTH);
      setScale(nextScale);
      setFrameWidth(Math.round(A4_WIDTH * nextScale));
    },
    []
  );

  useEffect(() => {
    updateScale();

    const wrap = wrapRef.current;
    if (!wrap) return;

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => updateScale());
      ro.observe(wrap);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  useLayoutEffect(() => {
    const node = scaledRef.current;
    if (!node) return;

    const updateHeight = () => {
      const baseHeight = Math.max(A4_MIN_HEIGHT, Math.ceil(node.scrollHeight));
      setFrameHeight(Math.ceil(baseHeight * scale));
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => updateHeight());
      ro.observe(node);
      return () => ro.disconnect();
    }

    const id = window.setTimeout(updateHeight, 50);
    return () => window.clearTimeout(id);
  }, [model, scale]);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-6 text-slate-200">
        กำลังโหลด Weekly report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        {error}
      </div>
    );
  }

  if (!model) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-6 text-slate-300">
        กรุณาเลือกโครงการและรายงานประจำสัปดาห์
      </div>
    );
  }

  const pm = model.summary;
  const ts = model.timeSummary;
  const workItems = model.workPerformedWeekly || [];
  const problems = model.problemsAndObstacles || [];
  const progress = model.progressByCategory || [];
  const supervisors = model.supervisors || [];

  return (
    <>
      <style jsx>{`
        .previewWrap {
          width: 100%;
          overflow: hidden;
          padding: 0;
        }

        .previewCenter {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .previewFrame {
          position: relative;
          max-width: 100%;
        }

        .previewScaled {
          transform-origin: top left;
          will-change: transform;
        }

        .a4 {
          background: #ffffff;
          color: #111111;
          border: 2px solid #111111;
          border-radius: 14px;
          padding: 14px;
          font-size: 13px;
          line-height: 1.2;
          box-sizing: border-box;
        }

        .box {
          border: 2px solid #111111;
          border-radius: 12px;
          overflow: hidden;
        }

        .cell {
          border: 1.5px solid #111111;
          padding: 6px 8px;
          vertical-align: top;
        }

        .cellCenter {
          border: 1.5px solid #111111;
          padding: 6px 8px;
          text-align: center;
          vertical-align: middle;
        }

        .titleBar {
          background: #eadcf6;
          font-weight: 700;
        }

        .sectionBar {
          background: #dff2df;
          font-weight: 700;
          text-align: center;
        }

        .subBar {
          background: #f4e8d4;
          font-weight: 700;
          text-align: center;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th,
        td {
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .hMain {
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.2px;
        }

        .hSub {
          font-weight: 600;
          font-size: 13px;
        }

        .mini th,
        .mini td {
          border: 1.5px solid #111111;
          padding: 4px 6px;
          font-size: 10px;
          line-height: 1.05;
        }

        .mini th {
          text-align: center;
          vertical-align: middle;
          font-weight: 700;
        }

        .mini td {
          vertical-align: top;
        }

        .mini .c {
          text-align: center;
          vertical-align: middle;
        }

        .wrapText {
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .multiline {
          white-space: pre-wrap;
        }
      `}</style>

      <div ref={wrapRef} className="previewWrap">
        <div className="previewCenter">
          <div
            className="previewFrame"
            style={{
              width: frameWidth,
              height: frameHeight,
            }}
          >
            <div
              ref={scaledRef}
              className="previewScaled"
              style={{
                width: A4_WIDTH,
                transform: `scale(${scale}) translateZ(0)`,
              }}
            >
              <div className="a4">
                <div className="box">
                  <table>
                    <colgroup>
                      <col style={{ width: "19%" }} />
                      <col style={{ width: "81%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="cellCenter">
                          <div className="mx-auto flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-full border-2 border-black bg-white">
                            <Image
                              src="/logo.png"
                              alt="Company Logo"
                              width={110}
                              height={110}
                              className="h-full w-full object-contain"
                              priority
                            />
                          </div>
                        </td>
                        <td className="cellCenter titleBar">
                          <div className="hMain">
                            รายงานการควบคุมงานก่อสร้างประจำสัปดาห์ (WEEKLY REPORT)
                          </div>
                          <div className="mt-1 hSub">สัปดาห์ที่ {model.weekNo}</div>
                          <div className="mt-1 hSub">
                            ช่วงวันที่ {formatDateBE(model.startDate)} ถึง{" "}
                            {formatDateBE(model.endDate)}
                          </div>
                          <div className="mt-1 hSub">
                            โครงการ : {textOrDash(pm.projectName)}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <colgroup>
                      <col style={{ width: "19%" }} />
                      <col style={{ width: "31%" }} />
                      <col style={{ width: "19%" }} />
                      <col style={{ width: "31%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="cell">สัญญาจ้าง</td>
                        <td className="cell">{textOrDash(pm.contractNo)}</td>
                        <td className="cell">สถานที่ก่อสร้าง</td>
                        <td className="cell">{textOrDash(pm.siteLocation)}</td>
                      </tr>
                      <tr>
                        <td className="cell">งวดงาน</td>
                        <td className="cell">{textOrDash(pm.installmentLabel)}</td>
                        <td className="cell">วงเงินค่าก่อสร้าง</td>
                        <td className="cell">{textOrDash(pm.contractValue)}</td>
                      </tr>
                      <tr>
                        <td className="cell">เริ่มสัญญา</td>
                        <td className="cell">{formatDateBE(pm.contractStart)}</td>
                        <td className="cell">ผู้รับจ้าง</td>
                        <td className="cell">{textOrDash(pm.contractorName)}</td>
                      </tr>
                      <tr>
                        <td className="cell">สิ้นสุดสัญญา</td>
                        <td className="cell">{formatDateBE(pm.contractEnd)}</td>
                        <td className="cell">วิธีจัดซื้อจัดจ้าง</td>
                        <td className="cell">{textOrDash(pm.procurementMethod)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cellCenter sectionBar">สรุประยะเวลา</td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <colgroup>
                      <col style={{ width: "20%" }} />
                      <col style={{ width: "13.333%" }} />
                      <col style={{ width: "13.333%" }} />
                      <col style={{ width: "13.333%" }} />
                      <col style={{ width: "13.333%" }} />
                      <col style={{ width: "13.333%" }} />
                      <col style={{ width: "13.333%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="cellCenter subBar">รายการ</td>
                        <td className="cellCenter subBar">ตามสัญญา</td>
                        <td className="cellCenter subBar">ก่อนหน้า</td>
                        <td className="cellCenter subBar">สัปดาห์นี้</td>
                        <td className="cellCenter subBar">สะสม</td>
                        <td className="cellCenter subBar">คงเหลือ</td>
                        <td className="cellCenter subBar">คลาดเคลื่อน</td>
                      </tr>
                      <tr>
                        <td className="cell">จำนวนวัน</td>
                        <td className="cellCenter">{formatInteger(ts.contractDays)}</td>
                        <td className="cellCenter">
                          {formatInteger(ts.previousUsedDays)}
                        </td>
                        <td className="cellCenter">
                          {formatInteger(ts.currentWeekDays)}
                        </td>
                        <td className="cellCenter">
                          {formatInteger(ts.accumulatedDays)}
                        </td>
                        <td className="cellCenter">
                          {formatInteger(ts.remainingDays)}
                        </td>
                        <td className="cellCenter">
                          {formatInteger(ts.varianceDays ?? null)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cellCenter sectionBar">
                          ผลงานที่ดำเนินการประจำสัปดาห์
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="mini">
                    <colgroup>
                      <col style={{ width: "6%" }} />
                      <col style={{ width: "39%" }} />
                      <col style={{ width: "19%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "14%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>ลำดับ</th>
                        <th>รายการงาน</th>
                        <th>ตำแหน่ง</th>
                        <th>ปริมาณ</th>
                        <th>หน่วย</th>
                        <th>หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workItems.length ? (
                        workItems.map((item, index) => (
                          <tr key={item.id}>
                            <td className="c">{index + 1}</td>
                            <td className="wrapText">
                              {textOrDash(item.description)}
                            </td>
                            <td className="wrapText">
                              {textOrDash(item.location)}
                            </td>
                            <td className="c">
                              {item.qty == null ? "-" : formatNumber(item.qty, 2)}
                            </td>
                            <td className="c">{textOrDash(item.unit)}</td>
                            <td className="wrapText">
                              {textOrDash(item.remark)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="c">
                            ไม่มีรายการงาน
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cellCenter sectionBar">
                          ความคิดเห็นผู้ควบคุมงาน
                        </td>
                      </tr>
                      <tr>
                        <td className="cell multiline" style={{ minHeight: 84 }}>
                          {textOrDash(model.comments)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cellCenter sectionBar">ปัญหาและอุปสรรค</td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="mini">
                    <colgroup>
                      <col style={{ width: "6%" }} />
                      <col style={{ width: "34%" }} />
                      <col style={{ width: "30%" }} />
                      <col style={{ width: "30%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>ลำดับ</th>
                        <th>หัวข้อ</th>
                        <th>ผลกระทบ</th>
                        <th>แนวทางแก้ไข</th>
                      </tr>
                    </thead>
                    <tbody>
                      {problems.length ? (
                        problems.map((item, index) => (
                          <tr key={item.id}>
                            <td className="c">{index + 1}</td>
                            <td className="wrapText">{textOrDash(item.topic)}</td>
                            <td className="wrapText">{textOrDash(item.impact)}</td>
                            <td className="wrapText">{textOrDash(item.solution)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="c">
                            ไม่มีปัญหาและอุปสรรค
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cellCenter sectionBar">
                          ความปลอดภัยในการทำงาน
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <colgroup>
                      <col style={{ width: "25%" }} />
                      <col style={{ width: "25%" }} />
                      <col style={{ width: "25%" }} />
                      <col style={{ width: "25%" }} />
                    </colgroup>
                    <tbody>
                      <tr>
                        <td className="cellCenter subBar">อุบัติเหตุ</td>
                        <td className="cellCenter subBar">บาดเจ็บ</td>
                        <td className="cellCenter subBar">Lost Time</td>
                        <td className="cellCenter subBar">หมายเหตุ</td>
                      </tr>
                      <tr>
                        <td className="cellCenter">
                          {formatInteger(model.safety.accidentCount ?? 0)}
                        </td>
                        <td className="cellCenter">
                          {formatInteger(model.safety.injuredCount ?? 0)}
                        </td>
                        <td className="cellCenter">
                          {formatInteger(model.safety.lostTimeCount ?? 0)}
                        </td>
                        <td className="cell multiline">
                          {textOrDash(model.safety.note)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cellCenter sectionBar">สรุปความก้าวหน้า</td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="mini">
                    <colgroup>
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "16%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>หมวดงาน</th>
                        <th>น้ำหนัก (%)</th>
                        <th>ก่อนหน้า (%)</th>
                        <th>สัปดาห์นี้ (%)</th>
                        <th>สะสม (%)</th>
                        <th>คงเหลือ (%)</th>
                        <th>แผน (%)</th>
                        <th>คลาดเคลื่อน (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.length ? (
                        <>
                          {progress.map((item) => (
                            <tr key={item.id}>
                              <td className="wrapText">
                                {textOrDash(item.category)}
                              </td>
                              <td className="c">
                                {formatNumber(item.weightPercent)}
                              </td>
                              <td className="c">
                                {formatNumber(item.previousPercent)}
                              </td>
                              <td className="c">
                                {formatNumber(item.weeklyPercent)}
                              </td>
                              <td className="c">
                                {formatNumber(item.accumulatedPercent)}
                              </td>
                              <td className="c">
                                {formatNumber(item.remainingPercent)}
                              </td>
                              <td className="c">
                                {formatNumber(item.plannedPercent ?? null)}
                              </td>
                              <td className="c">
                                {formatNumber(item.variancePercent ?? null)}
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td className="c">
                              <strong>รวม</strong>
                            </td>
                            <td className="c">
                              <strong>{formatNumber(totalWeight)}</strong>
                            </td>
                            <td className="c">
                              <strong>{formatNumber(totalPrev)}</strong>
                            </td>
                            <td className="c">
                              <strong>{formatNumber(totalWeekly)}</strong>
                            </td>
                            <td className="c">
                              <strong>{formatNumber(totalAccum)}</strong>
                            </td>
                            <td className="c">
                              <strong>{formatNumber(totalRemain)}</strong>
                            </td>
                            <td className="c">-</td>
                            <td className="c">-</td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colSpan={8} className="c">
                            ยังไม่มีตารางสรุปความก้าวหน้า
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cellCenter sectionBar">
                          ผู้ควบคุมงาน / ผู้ลงนาม
                        </td>
                      </tr>
                      <tr>
                        <td className="cell">
                          <SignatureGrid items={supervisors} />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table>
                    <tbody>
                      <tr>
                        <td className="cell">
                          <strong>หมายเหตุ:</strong>{" "}
                          เอกสารนี้เป็นข้อมูล Weekly Report ที่ถูกสรุปจากระบบและจัดเก็บในฐานข้อมูล
                        </td>
                      </tr>
                      <tr>
                        <td className="cell">
                          วันที่สร้างข้อมูลล่าสุด:{" "}
                          {model.updatedAt ? formatDateThai(model.updatedAt) : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default WeeklyReportForm;