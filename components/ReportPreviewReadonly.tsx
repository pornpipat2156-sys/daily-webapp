// components/ReportPreviewReadonly.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type AnyJson = Record<string, any>;

type IssueCommentRow = {
  id: string;
  comment: string;
  createdAt: string;
  author?: { name?: string | null; email?: string | null } | null;
};

type IssueRow = {
  id: string;
  title?: string | null;
  detail?: string | null;
  images?: string[] | { url: string }[];
  comments?: IssueCommentRow[];
};

type ContractorRow = { id?: string; name: string; position: string; qty: number };
type SubContractorRow = { id?: string; position: string; morning: number; afternoon: number; overtime: number };
type EquipmentRow = { id?: string; type: string; morning: number; afternoon: number; overtime: number };
type WorkRow = { id?: string; description: string; location: string; qty: string | number; unit: string; material: string };

type Props = {
  reportId: string;
  includeIssueComments?: boolean;
  logoUrl?: string; // default /logo.png
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateBE(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

function get(obj: any, path: string[]) {
  let cur = obj;
  for (const k of path) {
    if (cur && typeof cur === "object" && k in cur) cur = cur[k];
    else return undefined;
  }
  return cur;
}

function pick(obj: any, paths: string[][]) {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function asArr<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asStr(v: any) {
  if (v === undefined || v === null) return "";
  return String(v);
}

function asNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function issueImageUrl(x: any) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && typeof x.url === "string") return x.url;
  return "";
}

export function ReportPreviewReadonly({ reportId, includeIssueComments = false, logoUrl = "/logo.png" }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [raw, setRaw] = useState<AnyJson | null>(null);

  useEffect(() => {
    let cancel = false;
    async function run() {
      setErr("");
      setRaw(null);
      if (!reportId) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as AnyJson | null;
        if (!res.ok || !json) throw new Error(json?.message || "โหลดรายงานไม่สำเร็จ");
        if (!cancel) setRaw(json);
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

  // --- normalize report/meta/payload/issues ---
  const report = useMemo(() => {
    if (!raw) return null;
    return (raw.report && typeof raw.report === "object" ? raw.report : raw) as AnyJson;
  }, [raw]);

  const meta = useMemo(() => {
    if (!raw) return null;
    const v =
      pick(raw, [["projectMeta"], ["meta"], ["project", "meta"], ["report", "projectMeta"], ["report", "meta"]]) ?? null;
    return v && typeof v === "object" ? (v as AnyJson) : null;
  }, [raw]);

  const payload = useMemo(() => {
    if (!raw) return null;
    const v =
      pick(raw, [["payload"], ["data"], ["dailyReportPayload"], ["report", "payload"], ["report", "data"]]) ?? null;
    return v && typeof v === "object" ? (v as AnyJson) : null;
  }, [raw]);

  const projectName = useMemo(() => {
    return (
      pick(raw, [["projectName"], ["project", "projectName"], ["project", "name"], ["report", "projectName"]]) ??
      pick(meta, [["projectName"], ["name"]]) ??
      "-"
    );
  }, [raw, meta]);

  const dateISO = useMemo(() => {
    return (
      pick(report, [["date"], ["reportDate"]]) ?? pick(raw, [["date"], ["reportDate"]]) ?? pick(payload, [["date"]]) ?? ""
    );
  }, [report, raw, payload]);

  const issues: IssueRow[] = useMemo(() => {
    const v = pick(raw, [["issues"], ["report", "issues"]]);
    if (Array.isArray(v)) return v as IssueRow[];
    const v2 = pick(payload, [["issues"], ["issueList"], ["problemIssues"]]);
    return Array.isArray(v2) ? (v2 as IssueRow[]) : [];
  }, [raw, payload]);

  // --- meta fields (ตามฟอร์มในรูป) ---
  const contractNo = asStr(pick(meta, [["contractNo"]]) ?? "");
  const annexNo = asStr(pick(meta, [["annexNo"]]) ?? "");
  const contractStart = asStr(pick(meta, [["contractStart"]]) ?? "");
  const contractEnd = asStr(pick(meta, [["contractEnd"]]) ?? "");
  const contractorName = asStr(pick(meta, [["contractorName"], ["contractor"]]) ?? "");
  const siteLocation = asStr(pick(meta, [["siteLocation"]]) ?? "");
  const contractValue = asStr(pick(meta, [["contractValue"]]) ?? "");
  const procurementMethod = asStr(pick(meta, [["procurementMethod"]]) ?? "");
  const installmentCount = asStr(pick(meta, [["installmentCount"]]) ?? "");
  const totalDurationDays = asStr(pick(meta, [["totalDurationDays"]]) ?? "");

  const periodNo = asStr(pick(meta, [["periodNo"]]) ?? "");
  const weekNo = asStr(pick(meta, [["weekNo"]]) ?? "");

  // --- time/weather (ตามกล่องสีเหลือง) ---
  const morningTime = asStr(pick(payload, [["timeMorning"], ["morningTime"]]) ?? "08:30น.-12:00น.");
  const afternoonTime = asStr(pick(payload, [["timeAfternoon"], ["afternoonTime"]]) ?? "13:00น.-17:00น.");
  const overtimeTime = asStr(pick(payload, [["timeOvertime"], ["overtimeTime"]]) ?? "17:00น. ขึ้นไป");

  const weatherHigh = asStr(pick(payload, [["weatherHigh"], ["tempMax"], ["maxTemp"]]) ?? "");
  const weatherLow = asStr(pick(payload, [["weatherLow"], ["tempMin"], ["minTemp"]]) ?? "");

  // --- tables (ทีม/เครื่องจักร/งาน) ---
  const contractors: ContractorRow[] = useMemo(() => {
    const v = pick(payload, [["contractors"], ["contractorRows"]]);
    return asArr(v).map((x: any) => ({
      id: x?.id,
      name: asStr(x?.name),
      position: asStr(x?.position),
      qty: asNum(x?.qty),
    }));
  }, [payload]);

  const subContractors: SubContractorRow[] = useMemo(() => {
    const v = pick(payload, [["subContractors"], ["subContractorRows"]]);
    return asArr(v).map((x: any) => ({
      id: x?.id,
      position: asStr(x?.position),
      morning: asNum(x?.morning),
      afternoon: asNum(x?.afternoon),
      overtime: asNum(x?.overtime),
    }));
  }, [payload]);

  const equipments: EquipmentRow[] = useMemo(() => {
    const v = pick(payload, [["equipments"], ["equipmentRows"], ["majorEquipment"]]);
    return asArr(v).map((x: any) => ({
      id: x?.id,
      type: asStr(x?.type || x?.kind),
      morning: asNum(x?.morning),
      afternoon: asNum(x?.afternoon),
      overtime: asNum(x?.overtime),
    }));
  }, [payload]);

  const works: WorkRow[] = useMemo(() => {
    const v = pick(payload, [["works"], ["workPerformed"], ["workRows"]]);
    return asArr(v).map((x: any) => ({
      id: x?.id,
      description: asStr(x?.description),
      location: asStr(x?.location),
      qty: x?.qty ?? "",
      unit: asStr(x?.unit),
      material: asStr(x?.material),
    }));
  }, [payload]);

  const totalContractors = contractors.reduce((s, r) => s + (Number.isFinite(r.qty) ? r.qty : 0), 0);
  const totalSubMorning = subContractors.reduce((s, r) => s + r.morning, 0);
  const totalSubAfternoon = subContractors.reduce((s, r) => s + r.afternoon, 0);
  const totalSubOvertime = subContractors.reduce((s, r) => s + r.overtime, 0);
  const totalEqMorning = equipments.reduce((s, r) => s + r.morning, 0);
  const totalEqAfternoon = equipments.reduce((s, r) => s + r.afternoon, 0);
  const totalEqOvertime = equipments.reduce((s, r) => s + r.overtime, 0);

  // --- issue comment summary for "ช่องความเห็น" ---
  const issueCommentText = useMemo(() => {
    if (!includeIssueComments) return "";
    if (!issues.length) return "";
    // รวม comment ของแต่ละ issue เป็นข้อความเดียว (แสดงในช่องขวาแบบในรูป)
    const parts: string[] = [];
    issues.forEach((it, idx) => {
      const cs = asArr<IssueCommentRow>(it.comments);
      if (!cs.length) return;
      const joined = cs
        .map((c) => {
          const who = c.author?.name || c.author?.email || "ผู้แสดงความคิดเห็น";
          return `- (${who}) ${asStr(c.comment)}`;
        })
        .join("\n");
      parts.push(`ปัญหาที่ ${idx + 1}\n${joined}`);
    });
    return parts.join("\n\n");
  }, [includeIssueComments, issues]);

  if (!reportId) return null;

  if (loading) {
    return <div className="rounded-2xl border bg-card p-4 opacity-80">กำลังโหลดฟอร์มรายงาน...</div>;
  }
  if (err) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="text-sm text-red-600">{err}</div>
      </div>
    );
  }
  if (!raw) return null;

  // ---- Styles (โทนเหมือนรูป) ----
  const box = "border-2 border-black rounded-xl";
  const th = "border border-black px-2 py-1 text-sm font-semibold bg-white";
  const td = "border border-black px-2 py-1 text-sm";

  return (
    <div className="w-full flex justify-center">
      {/* “กระดาษ” */}
      <div className="w-full max-w-[980px]">
        <div className="border-2 border-black rounded-2xl overflow-hidden bg-white">
          {/* Header */}
          <div className="grid grid-cols-[160px_1fr] border-b-2 border-black">
            <div className="flex items-center justify-center p-3 border-r-2 border-black">
              <div className="relative h-[120px] w-[120px]">
                <Image src={logoUrl} alt="logo" fill className="object-contain" />
              </div>
            </div>

            <div className="p-4 bg-[#e9ddff]">
              <div className="text-center">
                <div className="text-xl font-extrabold">
                  รายงานการควบคุมงานก่อสร้างประจำวัน (DAILY REPORT)
                </div>
                <div className="mt-1 text-base font-semibold">ประจำวันที่ {formatDateBE(dateISO)}</div>
                <div className="mt-1 text-base font-semibold">โครงการ : {projectName}</div>
              </div>
            </div>
          </div>

          {/* Contract table */}
          <div className="p-3">
            <div className={box}>
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={`${th} w-[20%]`}>สัญญาจ้าง</td>
                    <td className={`${td} w-[35%]`}>{contractNo || "-"}</td>
                    <td className={`${th} w-[20%]`}>สถานที่ก่อสร้าง</td>
                    <td className={`${td} w-[25%]`}>{siteLocation || "-"}</td>
                  </tr>
                  <tr>
                    <td className={th}>บันทึกแนบท้ายที่</td>
                    <td className={td}>{annexNo || "-"}</td>
                    <td className={th}>วงเงินค่าก่อสร้าง</td>
                    <td className={td}>{contractValue || "-"}</td>
                  </tr>
                  <tr>
                    <td className={th}>เริ่มสัญญา</td>
                    <td className={td}>{contractStart ? formatDateBE(contractStart) : "-"}</td>
                    <td className={th}>ผู้รับจ้าง</td>
                    <td className={td}>{contractorName || "-"}</td>
                  </tr>
                  <tr>
                    <td className={th}>สิ้นสุดสัญญา</td>
                    <td className={td}>{contractEnd ? formatDateBE(contractEnd) : "-"}</td>
                    <td className={th}>จัดจ้างโดยวิธี</td>
                    <td className={td}>{procurementMethod || "-"}</td>
                  </tr>
                  <tr>
                    <td className={th}>จำนวนงวด</td>
                    <td className={td}>{installmentCount || "-"}</td>
                    <td className={th}>รวมเวลาก่อสร้าง</td>
                    <td className={td}>{totalDurationDays ? `${totalDurationDays} วัน` : "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Time + side small boxes */}
          <div className="px-3 pb-3">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
              <div className={`${box} p-3 bg-[#fffbe6]`}>
                <div className="font-bold">ช่วงเวลาทำงาน</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div>ช่วงเช้า {morningTime}</div>
                  <div>ช่วงบ่าย {afternoonTime}</div>
                  <div>ล่วงเวลา {overtimeTime}</div>
                </div>

                <div className="mt-3 font-bold">สภาพอากาศ (WEATHER)</div>
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>อุณหภูมิ สูงสุด: {weatherHigh ? `${weatherHigh}°C` : "-"} </div>
                  <div>อุณหภูมิ ต่ำสุด: {weatherLow ? `${weatherLow}°C` : "-"} </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`${box} p-3 bg-[#fffbe6]`}>
                  <div className="text-sm font-semibold">{totalDurationDays || "-"} / {totalDurationDays || "-"}</div>
                </div>
                <div className={`${box} p-3 bg-[#fffbe6]`}>
                  <div className="text-sm font-semibold">งวด {periodNo || "-"}/{installmentCount || "-"}</div>
                </div>
                <div className={`${box} p-3 bg-[#fffbe6]`}>
                  <div className="text-sm font-semibold">สัปดาห์ {weekNo || "-"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Project team tables */}
          <div className="px-3 pb-3">
            <div className={`${box} overflow-hidden`}>
              <div className="bg-[#dff6df] border-b-2 border-black py-2 text-center font-bold">
                ส่วนโครงการ (PROJECT TEAM)
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
                {/* Contractors */}
                <div className="p-3 border-b-2 lg:border-b-0 lg:border-r-2 border-black">
                  <div className="text-center font-bold mb-2">ผู้รับเหมา (CONTRACTORS)</div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={th}>#</th>
                        <th className={th}>รายชื่อ</th>
                        <th className={th}>ตำแหน่ง</th>
                        <th className={th}>จำนวนคน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(contractors.length ? contractors : [{ name: "-", position: "-", qty: 0 }]).map((r, i) => (
                        <tr key={i}>
                          <td className={td}>{i + 1}</td>
                          <td className={td}>{r.name || "-"}</td>
                          <td className={td}>{r.position || "-"}</td>
                          <td className={td}>{r.qty ?? 0}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className={`${td} text-right font-semibold`} colSpan={3}>
                          รวม
                        </td>
                        <td className={`${td} font-semibold`}>{totalContractors}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Sub contractors */}
                <div className="p-3 border-b-2 lg:border-b-0 lg:border-r-2 border-black">
                  <div className="text-center font-bold mb-2">ผู้รับเหมารายย่อย (SUB CONTRACTORS)</div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={th}>#</th>
                        <th className={th}>ตำแหน่ง</th>
                        <th className={th}>เช้า</th>
                        <th className={th}>บ่าย</th>
                        <th className={th}>ล่วงเวลา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(subContractors.length ? subContractors : [{ position: "-", morning: 0, afternoon: 0, overtime: 0 }]).map(
                        (r, i) => (
                          <tr key={i}>
                            <td className={td}>{i + 1}</td>
                            <td className={td}>{r.position || "-"}</td>
                            <td className={td}>{r.morning ?? 0}</td>
                            <td className={td}>{r.afternoon ?? 0}</td>
                            <td className={td}>{r.overtime ?? 0}</td>
                          </tr>
                        )
                      )}
                      <tr>
                        <td className={`${td} text-right font-semibold`} colSpan={2}>
                          รวม
                        </td>
                        <td className={`${td} font-semibold`}>{totalSubMorning}</td>
                        <td className={`${td} font-semibold`}>{totalSubAfternoon}</td>
                        <td className={`${td} font-semibold`}>{totalSubOvertime}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Equipment */}
                <div className="p-3">
                  <div className="text-center font-bold mb-2">เครื่องจักรหลัก (MAJOR EQUIPMENT)</div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={th}>#</th>
                        <th className={th}>ชนิด</th>
                        <th className={th}>เช้า</th>
                        <th className={th}>บ่าย</th>
                        <th className={th}>ล่วงเวลา</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(equipments.length ? equipments : [{ type: "-", morning: 0, afternoon: 0, overtime: 0 }]).map((r, i) => (
                        <tr key={i}>
                          <td className={td}>{i + 1}</td>
                          <td className={td}>{r.type || "-"}</td>
                          <td className={td}>{r.morning ?? 0}</td>
                          <td className={td}>{r.afternoon ?? 0}</td>
                          <td className={td}>{r.overtime ?? 0}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className={`${td} text-right font-semibold`} colSpan={2}>
                          รวม
                        </td>
                        <td className={`${td} font-semibold`}>{totalEqMorning}</td>
                        <td className={`${td} font-semibold`}>{totalEqAfternoon}</td>
                        <td className={`${td} font-semibold`}>{totalEqOvertime}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Work performed */}
          <div className="px-3 pb-3">
            <div className={`${box} overflow-hidden`}>
              <div className="bg-[#f6ead2] border-b-2 border-black py-2 text-center font-bold">
                รายละเอียดของงานที่ได้ดำเนินงานทำแล้ว (WORK PERFORMED)
              </div>
              <div className="p-3">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={th}>#</th>
                      <th className={th}>รายการ (DESCRIPTION)</th>
                      <th className={th}>บริเวณ (LOCATIONS)</th>
                      <th className={th}>จำนวน</th>
                      <th className={th}>หน่วย</th>
                      <th className={th}>วัสดุนำเข้า (MATERIAL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(works.length ? works : [{ description: "-", location: "-", qty: "-", unit: "-", material: "-" }]).map(
                      (r, i) => (
                        <tr key={i}>
                          <td className={td}>{i + 1}</td>
                          <td className={td}>{r.description || "-"}</td>
                          <td className={td}>{r.location || "-"}</td>
                          <td className={td}>{asStr(r.qty) || "-"}</td>
                          <td className={td}>{r.unit || "-"}</td>
                          <td className={td}>{r.material || "-"}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Issues section (แบบ 3 คอลัมน์เหมือนรูป) */}
          <div className="px-3 pb-4">
            <div className={`${box} overflow-hidden`}>
              <div className="grid grid-cols-3 border-b-2 border-black">
                <div className="bg-[#e9ddff] py-2 text-center font-bold border-r-2 border-black">ภาพปัญหาและอุปสรรค</div>
                <div className="bg-[#e9ddff] py-2 text-center font-bold border-r-2 border-black">รายละเอียด</div>
                <div className="bg-[#e9ddff] py-2 text-center font-bold">ความเห็นของผู้ควบคุมงาน</div>
              </div>

              {issues.length === 0 ? (
                <div className="p-4 text-sm text-green-700">ไม่มีปัญหาและอุปสรรค ✅</div>
              ) : (
                <div className="divide-y-2 divide-black">
                  {issues.map((it, idx) => {
                    const img = issueImageUrl(asArr(it.images)[0]);
                    return (
                      <div key={it.id} className="grid grid-cols-1 md:grid-cols-3">
                        {/* Image */}
                        <div className="p-3 border-b-2 md:border-b-0 md:border-r-2 border-black">
                          <div className="font-semibold mb-2">ปัญหาที่ {idx + 1}</div>
                          <div className="border-2 border-black rounded-lg overflow-hidden bg-white min-h-[180px] flex items-center justify-center">
                            {img ? (
                              // ใช้ img กันปัญหา domain next/image
                              <img src={img} alt={`issue-${idx + 1}`} className="w-full h-auto block" />
                            ) : (
                              <div className="text-sm opacity-60">ไม่มีรูป</div>
                            )}
                          </div>
                        </div>

                        {/* Detail */}
                        <div className="p-3 border-b-2 md:border-b-0 md:border-r-2 border-black">
                          <div className="font-semibold mb-2">{it.title ? it.title : `ปัญหาที่ ${idx + 1}`}</div>
                          <div className="text-sm whitespace-pre-wrap">{it.detail || "-"}</div>
                        </div>

                        {/* Comment box */}
                        <div className="p-3">
                          <div className="font-semibold mb-2">ความเห็นของผู้ควบคุมงาน</div>
                          <div className="border-2 border-black rounded-lg p-3 min-h-[180px] bg-white">
                            {includeIssueComments ? (
                              <div className="text-sm whitespace-pre-wrap">{issueCommentText || "-"}</div>
                            ) : (
                              <div className="text-sm opacity-60">-</div>
                            )}
                          </div>

                          {/* ถ้าต้องการโชว์คอมเมนต์แยกตาม issue (อ่านง่ายกว่า) เปิดบล็อกนี้ */}
                          {includeIssueComments ? (
                            <div className="mt-3">
                              <div className="text-xs font-semibold mb-1">รายการความเห็นของปัญหานี้</div>
                              {asArr<IssueCommentRow>(it.comments).length === 0 ? (
                                <div className="text-xs opacity-60">ยังไม่มีความเห็น</div>
                              ) : (
                                <div className="space-y-2">
                                  {asArr<IssueCommentRow>(it.comments).map((c) => (
                                    <div key={c.id} className="rounded-lg border p-2 text-xs bg-muted/10">
                                      <div className="opacity-70">
                                        {c.author?.name || c.author?.email || "ผู้แสดงความคิดเห็น"} •{" "}
                                        {fmtDateTimeTH(c.createdAt)}
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap">{c.comment}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* หมายเหตุ: ถ้าคุณต้องการให้ “เหมือน A4 เป๊ะ” + scale ตอนพิมพ์/pdf
            ให้ครอบด้วย container ของหน้า preview เดิม (scale A4) ได้เลย */}
      </div>
    </div>
  );
}

function fmtDateTimeTH(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("th-TH");
}
