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
    return <div style={{ padding: "12px 16px" }}>ยังไม่มีข้อมูลผู้ลงนาม</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={`signature-row-${ri}`}>
            {row.map((it, i) => (
              <td
                key={`${it.name}-${i}`}
                style={{
                  width: `${100 / 3}%`,
                  border: "1px solid #111",
                  padding: "20px 12px 16px",
                  textAlign: "center",
                  verticalAlign: "top",
                  height: 140,
                }}
              >
                <div style={{ marginTop: 30, marginBottom: 10 }}>
                  ลงชื่อ ................................
                </div>
                <div style={{ fontWeight: 700 }}>({it.name || "-"})</div>
                <div>{it.role || " "}</div>
              </td>
            ))}
            {Array.from({ length: Math.max(0, 3 - row.length) }).map((_, emptyIndex) => (
              <td
                key={`empty-${ri}-${emptyIndex}`}
                style={{
                  width: `${100 / 3}%`,
                  border: "1px solid #111",
                  padding: "20px 12px 16px",
                  textAlign: "center",
                  verticalAlign: "top",
                  height: 140,
                }}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cellStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    border: "1px solid #111",
    padding: "6px 8px",
    verticalAlign: "middle",
    ...extra,
  };
}

function headerCellStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    ...cellStyle(extra),
    fontWeight: 700,
    textAlign: "center",
    background: "#eef3ee",
  };
}

function sectionBarStyle(): React.CSSProperties {
  return {
    border: "1px solid #111",
    padding: "8px 10px",
    fontWeight: 700,
    textAlign: "center",
    background: "#dce8d8",
    fontSize: 16,
  };
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
    return <div>กำลังโหลด Weekly report...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!model) {
    return <div>กรุณาเลือกโครงการและรายงานประจำสัปดาห์</div>;
  }

  const pm = model.summary;
  const ts = model.timeSummary;
  const workItems = model.workPerformedWeekly || [];
  const problems = model.problemsAndObstacles || [];
  const progress = model.progressByCategory || [];
  const supervisors = model.supervisors || [];

  return (
    <div ref={wrapRef} style={{ width: "100%", overflowX: "auto", padding: PREVIEW_PADDING }}>
      <div
        style={{
          width: frameWidth,
          minHeight: frameHeight,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <div
          ref={scaledRef}
          style={{
            width: A4_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: "#fff",
            color: "#111",
            borderRadius: 16,
            border: "4px solid #111",
            padding: 18,
            boxSizing: "border-box",
            fontFamily: "Tahoma, Arial, sans-serif",
          }}
        >
          <div
            style={{
              border: "2px solid #111",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      ...cellStyle({
                        textAlign: "center",
                        padding: "16px 12px",
                        fontWeight: 700,
                        fontSize: 22,
                      }),
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <Image
                        src="/logo.png"
                        alt="Company Logo"
                        width={48}
                        height={48}
                        unoptimized
                      />
                      <div>
                        <div>รายงานการควบคุมงานก่อสร้างประจำสัปดาห์ (WEEKLY REPORT)</div>
                        <div style={{ fontSize: 18, marginTop: 4 }}>สัปดาห์ที่ {model.weekNo}</div>
                      </div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style={cellStyle({ textAlign: "center", fontWeight: 700 })}>
                    ช่วงวันที่ {formatDateBE(model.startDate)} ถึง {formatDateBE(model.endDate)}
                  </td>
                </tr>

                <tr>
                  <td style={cellStyle()}>
                    โครงการ : {textOrDash(pm.projectName)}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle()}>
                    สัญญาจ้าง {textOrDash(pm.contractNo)} สถานที่ก่อสร้าง {textOrDash(pm.siteLocation)}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle()}>
                    งวดงาน {textOrDash(pm.installmentLabel)} วงเงินค่าก่อสร้าง {textOrDash(pm.contractValue)}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle()}>
                    เริ่มสัญญา {formatDateBE(pm.contractStart)} ผู้รับจ้าง {textOrDash(pm.contractorName)}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle()}>
                    สิ้นสุดสัญญา {formatDateBE(pm.contractEnd)} วิธีจัดซื้อจัดจ้าง {textOrDash(pm.procurementMethod)}
                  </td>
                </tr>

                <tr>
                  <td style={sectionBarStyle()}>สรุประยะเวลา</td>
                </tr>
                <tr>
                  <td style={{ padding: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={headerCellStyle()}>รายการ</th>
                          <th style={headerCellStyle()}>ตามสัญญา</th>
                          <th style={headerCellStyle()}>ก่อนหน้า</th>
                          <th style={headerCellStyle()}>สัปดาห์นี้</th>
                          <th style={headerCellStyle()}>สะสม</th>
                          <th style={headerCellStyle()}>คงเหลือ</th>
                          <th style={headerCellStyle()}>คลาดเคลื่อน</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={cellStyle({ textAlign: "center", fontWeight: 700 })}>จำนวนวัน</td>
                          <td style={cellStyle({ textAlign: "center" })}>{formatInteger(ts.contractDays)}</td>
                          <td style={cellStyle({ textAlign: "center" })}>{formatInteger(ts.previousUsedDays)}</td>
                          <td style={cellStyle({ textAlign: "center" })}>{formatInteger(ts.currentWeekDays)}</td>
                          <td style={cellStyle({ textAlign: "center" })}>{formatInteger(ts.accumulatedDays)}</td>
                          <td style={cellStyle({ textAlign: "center" })}>{formatInteger(ts.remainingDays)}</td>
                          <td style={cellStyle({ textAlign: "center" })}>{formatInteger(ts.varianceDays ?? null)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={sectionBarStyle()}>ผลงานที่ดำเนินการประจำสัปดาห์</td>
                </tr>
                <tr>
                  <td style={{ padding: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={headerCellStyle({ width: 70 })}>ลำดับ</th>
                          <th style={headerCellStyle()}>รายการงาน</th>
                          <th style={headerCellStyle()}>ตำแหน่ง</th>
                          <th style={headerCellStyle()}>ปริมาณ</th>
                          <th style={headerCellStyle()}>หน่วย</th>
                          <th style={headerCellStyle()}>หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workItems.length ? (
                          workItems.map((item, index) => (
                            <tr key={item.id || `work-${index}`}>
                              <td style={cellStyle({ textAlign: "center" })}>{index + 1}</td>
                              <td style={cellStyle()}>{textOrDash(item.description)}</td>
                              <td style={cellStyle()}>{textOrDash(item.location)}</td>
                              <td style={cellStyle({ textAlign: "right" })}>
                                {item.qty == null ? "-" : formatNumber(item.qty, 2)}
                              </td>
                              <td style={cellStyle({ textAlign: "center" })}>{textOrDash(item.unit)}</td>
                              <td style={cellStyle()}>{textOrDash(item.remark)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td style={cellStyle({ textAlign: "center" })} colSpan={6}>
                              ไม่มีรายการงาน
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={sectionBarStyle()}>ความคิดเห็นผู้ควบคุมงาน</td>
                </tr>
                <tr>
                  <td
                    style={cellStyle({
                      height: "3in",
                      minHeight: "3in",
                      verticalAlign: "top",
                    })}
                  >
                    &nbsp;
                  </td>
                </tr>

                <tr>
                  <td style={sectionBarStyle()}>ปัญหาและอุปสรรค</td>
                </tr>
                <tr>
                  <td style={{ padding: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={headerCellStyle({ width: 70 })}>ลำดับ</th>
                          <th style={headerCellStyle()}>หัวข้อ</th>
                          <th style={headerCellStyle()}>ผลกระทบ</th>
                          <th style={headerCellStyle()}>แนวทางแก้ไข</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problems.length ? (
                          problems.map((item, index) => (
                            <tr key={item.id || `problem-${index}`}>
                              <td style={cellStyle({ textAlign: "center" })}>{index + 1}</td>
                              <td style={cellStyle()}>{textOrDash(item.topic)}</td>
                              <td style={cellStyle()}>{textOrDash(item.impact)}</td>
                              <td style={cellStyle()}>{textOrDash(item.solution)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td style={cellStyle({ textAlign: "center" })} colSpan={4}>
                              ไม่มีปัญหาและอุปสรรค
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={sectionBarStyle()}>ความปลอดภัยในการทำงาน</td>
                </tr>
                <tr>
                  <td style={{ padding: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={headerCellStyle()}>อุบัติเหตุ</th>
                          <th style={headerCellStyle()}>บาดเจ็บ</th>
                          <th style={headerCellStyle()}>Lost Time</th>
                          <th style={headerCellStyle()}>หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={cellStyle({ textAlign: "center" })}>
                            {formatInteger(model.safety.accidentCount ?? 0)}
                          </td>
                          <td style={cellStyle({ textAlign: "center" })}>
                            {formatInteger(model.safety.injuredCount ?? 0)}
                          </td>
                          <td style={cellStyle({ textAlign: "center" })}>
                            {formatInteger(model.safety.lostTimeCount ?? 0)}
                          </td>
                          <td style={cellStyle()}>{textOrDash(model.safety.note)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={sectionBarStyle()}>สรุปความก้าวหน้า</td>
                </tr>
                <tr>
                  <td style={{ padding: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={headerCellStyle()}>หมวดงาน</th>
                          <th style={headerCellStyle()}>น้ำหนัก (%)</th>
                          <th style={headerCellStyle()}>ก่อนหน้า (%)</th>
                          <th style={headerCellStyle()}>สัปดาห์นี้ (%)</th>
                          <th style={headerCellStyle()}>สะสม (%)</th>
                          <th style={headerCellStyle()}>คงเหลือ (%)</th>
                          <th style={headerCellStyle()}>แผน (%)</th>
                          <th style={headerCellStyle()}>คลาดเคลื่อน (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.length ? (
                          <>
                            {progress.map((item) => (
                              <tr key={item.id}>
                                <td style={cellStyle()}>{textOrDash(item.category)}</td>
                                <td style={cellStyle({ textAlign: "right" })}>
                                  {formatNumber(item.weightPercent)}
                                </td>
                                <td style={cellStyle({ textAlign: "right" })}>
                                  {formatNumber(item.previousPercent)}
                                </td>
                                <td style={cellStyle({ textAlign: "right" })}>
                                  {formatNumber(item.weeklyPercent)}
                                </td>
                                <td style={cellStyle({ textAlign: "right" })}>
                                  {formatNumber(item.accumulatedPercent)}
                                </td>
                                <td style={cellStyle({ textAlign: "right" })}>
                                  {formatNumber(item.remainingPercent)}
                                </td>
                                <td style={cellStyle({ textAlign: "right" })}>
                                  {formatNumber(item.plannedPercent ?? null)}
                                </td>
                                <td style={cellStyle({ textAlign: "right" })}>
                                  {formatNumber(item.variancePercent ?? null)}
                                </td>
                              </tr>
                            ))}
                            <tr>
                              <td style={cellStyle({ fontWeight: 700, textAlign: "center" })}>รวม</td>
                              <td style={cellStyle({ textAlign: "right", fontWeight: 700 })}>
                                {formatNumber(totalWeight)}
                              </td>
                              <td style={cellStyle({ textAlign: "right", fontWeight: 700 })}>
                                {formatNumber(totalPrev)}
                              </td>
                              <td style={cellStyle({ textAlign: "right", fontWeight: 700 })}>
                                {formatNumber(totalWeekly)}
                              </td>
                              <td style={cellStyle({ textAlign: "right", fontWeight: 700 })}>
                                {formatNumber(totalAccum)}
                              </td>
                              <td style={cellStyle({ textAlign: "right", fontWeight: 700 })}>
                                {formatNumber(totalRemain)}
                              </td>
                              <td style={cellStyle({ textAlign: "center", fontWeight: 700 })}>-</td>
                              <td style={cellStyle({ textAlign: "center", fontWeight: 700 })}>-</td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td style={cellStyle({ textAlign: "center" })} colSpan={8}>
                              ยังไม่มีตารางสรุปความก้าวหน้า
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={sectionBarStyle()}>ผู้ควบคุมงาน / ผู้ลงนาม</td>
                </tr>
                <tr>
                  <td style={{ padding: 0 }}>
                    <SignatureGrid items={supervisors} />
                  </td>
                </tr>

                <tr>
                  <td style={cellStyle({ fontWeight: 700 })}>
                    หมายเหตุ: เอกสารนี้เป็นข้อมูล Weekly Report ที่ถูกสรุปจากระบบและจัดเก็บในฐานข้อมูล
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle()}>
                    วันที่สร้างข้อมูลล่าสุด:{" "}
                    {model.createdAt ? formatDateThai(model.createdAt) : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeeklyReportForm;