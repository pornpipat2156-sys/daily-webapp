"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/generator/projects";

type Issue = {
  id: string;
  detail: string;
  imageDataUrl?: string; // base64
};

type WorkPerformedRow = {
  id: string;
  description: string;
  location: string;
  quantity: string; // เก็บเป็น string จะกรอกง่าย (เช่น "120 ตร.ม.")
  materialDelivered: string;
};

type ManpowerRow = {
  id: string;
  position: string;
  morning: number;
  afternoon: number;
  overtime: number;
};

type EquipmentRow = {
  id: string;
  name: string;
  qty: number;
};

type DailyReportPayload = {
  // ===== Generator-only (ผูกกับ project) =====
  projectId: string;
  projectName: string;
  contractNo: string;
  annexNo: string;
  contractStart: string;
  contractEnd: string;
  contractor: string;
  siteLocation: string;
  budgetTHB: number;
  procurementMethod: string;
  installmentCount: number;
  totalDurationDays: number;
  owners: { name: string; position?: string }[];

  // ===== Auto fields =====
  dateISO: string;        // YYYY-MM-DD
  day: number;
  month: number;
  yearBE: number;         // พ.ศ.
  tempMaxC?: number;
  tempMinC?: number;

  // ===== User fields =====
  weather: string;        // สภาพอากาศ (ให้ user เลือก)
  workingTimeStart: string;
  workingTimeEnd: string;

  workPerformed: WorkPerformedRow[];
  manpower: ManpowerRow[];
  equipment: EquipmentRow[];
  issues: { imageDataUrl: string; detail: string }[];

  safetyNote: string;     // บันทึกด้านความปลอดภัย
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// แปลงวันที่เป็น วัน/เดือน/ปี(พ.ศ.)
function toThaiParts(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const yearBE = d.getFullYear() + 543;
  return { day, month, yearBE };
}

function formatMoneyTHB(n: number) {
  return new Intl.NumberFormat("th-TH").format(n);
}

// ดึงอุณหภูมิสูงสุด/ต่ำสุดของวันจาก Open-Meteo (ไม่ต้องใช้ API KEY)
async function fetchDailyTemp(lat: number, lon: number, dateISO: string) {
  // ขอข้อมูลเป็นรายวัน (daily) max/min temp
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&timezone=Asia%2FBangkok` +
    `&start_date=${dateISO}&end_date=${dateISO}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("weather fetch failed");
  const data = await res.json();

  const maxArr = data?.daily?.temperature_2m_max;
  const minArr = data?.daily?.temperature_2m_min;
  const tempMaxC = Array.isArray(maxArr) ? Number(maxArr[0]) : undefined;
  const tempMinC = Array.isArray(minArr) ? Number(minArr[0]) : undefined;

  return { tempMaxC, tempMinC };
}

export default function DailyReportForm({ projects }: { projects: Project[] }) {
  const router = useRouter();

  // ===== Project selection (User เลือกได้เท่านั้น) =====
  const [projectId, setProjectId] = useState<string>("");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );

  // ===== Auto date =====
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const thaiParts = useMemo(() => toThaiParts(dateISO), [dateISO]);

  // ===== Auto temp (max/min) =====
  const [tempMaxC, setTempMaxC] = useState<number | undefined>(undefined);
  const [tempMinC, setTempMinC] = useState<number | undefined>(undefined);
  const [tempLoading, setTempLoading] = useState(false);

  // ===== User fields =====
  const [weather, setWeather] = useState("ท้องฟ้าแจ่มใส");
  const [workingTimeStart, setWorkingTimeStart] = useState("08:30");
  const [workingTimeEnd, setWorkingTimeEnd] = useState("17:30");

  const [workPerformed, setWorkPerformed] = useState<WorkPerformedRow[]>([
    { id: uid(), description: "", location: "", quantity: "", materialDelivered: "" },
  ]);

  const [manpower, setManpower] = useState<ManpowerRow[]>([
    { id: uid(), position: "หัวหน้าคนงาน", morning: 0, afternoon: 0, overtime: 0 },
  ]);

  const [equipment, setEquipment] = useState<EquipmentRow[]>([
    { id: uid(), name: "", qty: 0 },
  ]);

  const [issues, setIssues] = useState<Issue[]>([
    { id: uid(), detail: "", imageDataUrl: undefined },
  ]);

  const [safetyNote, setSafetyNote] = useState("");

  // เมื่อเลือกโครงการ หรือเปลี่ยนวัน ให้ไปดึงอุณหภูมิอัตโนมัติ
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedProject) {
        setTempMaxC(undefined);
        setTempMinC(undefined);
        return;
      }

      setTempLoading(true);
      try {
        const { tempMaxC, tempMinC } = await fetchDailyTemp(
          selectedProject.latitude,
          selectedProject.longitude,
          dateISO
        );
        if (!cancelled) {
          setTempMaxC(tempMaxC);
          setTempMinC(tempMinC);
        }
      } catch {
        // ถ้าดึงไม่ได้ ให้ปล่อยว่าง (ยังกรอกส่วนอื่นได้)
        if (!cancelled) {
          setTempMaxC(undefined);
          setTempMinC(undefined);
        }
      } finally {
        if (!cancelled) setTempLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedProject, dateISO]);

  // ===== helpers add/remove rows =====
  function addWorkRow() {
    setWorkPerformed((prev) => [...prev, { id: uid(), description: "", location: "", quantity: "", materialDelivered: "" }]);
  }
  function removeWorkRow(id: string) {
    setWorkPerformed((prev) => prev.filter((x) => x.id !== id));
  }

  function addManpowerRow() {
    setManpower((prev) => [...prev, { id: uid(), position: "", morning: 0, afternoon: 0, overtime: 0 }]);
  }
  function removeManpowerRow(id: string) {
    setManpower((prev) => prev.filter((x) => x.id !== id));
  }

  function addEquipmentRow() {
    setEquipment((prev) => [...prev, { id: uid(), name: "", qty: 0 }]);
  }
  function removeEquipmentRow(id: string) {
    setEquipment((prev) => prev.filter((x) => x.id !== id));
  }

  function addIssue() {
    setIssues((prev) => [...prev, { id: uid(), detail: "", imageDataUrl: undefined }]);
  }
  function removeIssue(id: string) {
    setIssues((prev) => prev.filter((x) => x.id !== id));
  }
  function updateIssueDetail(id: string, detail: string) {
    setIssues((prev) => prev.map((x) => (x.id === id ? { ...x, detail } : x)));
  }
  async function updateIssueImage(id: string, file?: File) {
    if (!file) {
      setIssues((prev) => prev.map((x) => (x.id === id ? { ...x, imageDataUrl: undefined } : x)));
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setIssues((prev) => prev.map((x) => (x.id === id ? { ...x, imageDataUrl: dataUrl } : x)));
  }

  const canSubmit = useMemo(() => {
    // ต้องเลือกโครงการก่อน
    if (!projectId) return false;

    // ตัวอย่างขั้นต่ำ: ต้องมีเวลาเริ่ม/สิ้นสุด
    if (!workingTimeStart || !workingTimeEnd) return false;

    return true;
  }, [projectId, workingTimeStart, workingTimeEnd]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    const payload: DailyReportPayload = {
      // Generator-only (ผูกกับชื่อโครงการเสมอ)
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      contractNo: selectedProject.contractNo,
      annexNo: selectedProject.annexNo,
      contractStart: selectedProject.contractStart,
      contractEnd: selectedProject.contractEnd,
      contractor: selectedProject.contractor,
      siteLocation: selectedProject.siteLocation,
      budgetTHB: selectedProject.budgetTHB,
      procurementMethod: selectedProject.procurementMethod,
      installmentCount: selectedProject.installmentCount,
      totalDurationDays: selectedProject.totalDurationDays,
      owners: selectedProject.owners,

      // Auto
      dateISO,
      day: thaiParts.day,
      month: thaiParts.month,
      yearBE: thaiParts.yearBE,
      tempMaxC,
      tempMinC,

      // User
      weather,
      workingTimeStart,
      workingTimeEnd,
      workPerformed,
      manpower,
      equipment,
      issues: issues
        .filter((it) => it.detail.trim() || it.imageDataUrl)
        .map((it) => ({ imageDataUrl: it.imageDataUrl || "", detail: it.detail || "" })),
      safetyNote,
    };

    sessionStorage.setItem("dailyReportPayload", JSON.stringify(payload));
    router.push("/daily-report/preview");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ===== Section: ส่วนโครงการ (อิงหน้าแรกฟอร์ม) ===== */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold">ส่วนโครงการ (Generator only)</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">โครงการ (เลือกเท่านั้น)</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            >
              <option value="">— เลือกโครงการ —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs opacity-60">
              * รายการโครงการ/ข้อมูลสัญญาถูกกำหนดโดย Generator เท่านั้น
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">วันที่ (อัตโนมัติ/แก้ได้ถ้าต้องการย้อนวัน)</label>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              required
            />
          </div>
        </div>

        {/* วัน/เดือน/ปี + อุณหภูมิ (ตามฟอร์มหน้าแรก) */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-sm font-medium mb-1">ประจำวันที่</label>
            <input className="w-full rounded-lg border px-3 py-2 bg-gray-50" value={thaiParts.day} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">เดือน</label>
            <input className="w-full rounded-lg border px-3 py-2 bg-gray-50" value={thaiParts.month} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">พ.ศ.</label>
            <input className="w-full rounded-lg border px-3 py-2 bg-gray-50" value={thaiParts.yearBE} readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">อุณหภูมิ (สูงสุด/ต่ำสุด)</label>
            <div className="rounded-lg border px-3 py-2 bg-gray-50 text-sm">
              {tempLoading ? (
                "กำลังดึงข้อมูล..."
              ) : (
                <>
                  สูงสุด: {tempMaxC ?? "-"}°C / ต่ำสุด: {tempMinC ?? "-"}°C
                </>
              )}
            </div>
          </div>
        </div>

        {/* แสดงข้อมูลสัญญา/จัดจ้าง/งวด (read-only) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label="สัญญาจ้าง" value={selectedProject?.contractNo ?? "-"} />
          <ReadOnlyField label="บันทึกแนบท้ายที่" value={selectedProject?.annexNo ?? "-"} />
          <ReadOnlyField label="เริ่มสัญญา" value={selectedProject?.contractStart ?? "-"} />
          <ReadOnlyField label="สิ้นสุดสัญญา" value={selectedProject?.contractEnd ?? "-"} />
          <ReadOnlyField label="ผู้รับจ้าง" value={selectedProject?.contractor ?? "-"} />
          <ReadOnlyField label="สถานที่ก่อสร้าง" value={selectedProject?.siteLocation ?? "-"} />
          <ReadOnlyField
            label="วงเงินค่าก่อสร้าง (บาท)"
            value={selectedProject ? formatMoneyTHB(selectedProject.budgetTHB) : "-"}
          />
          <ReadOnlyField label="จัดจ้างโดยวิธี" value={selectedProject?.procurementMethod ?? "-"} />
          <ReadOnlyField label="จำนวนงวด" value={selectedProject ? String(selectedProject.installmentCount) : "-"} />
          <ReadOnlyField label="รวมเวลาก่อสร้าง (วัน)" value={selectedProject ? String(selectedProject.totalDurationDays) : "-"} />
        </div>

        {/* รายชื่อผู้ควบคุมงาน (OWNER) - Generator only */}
        <div className="rounded-lg border p-3 bg-gray-50">
          <div className="text-sm font-semibold mb-2">รายชื่อผู้ควบคุมงาน (OWNER) (Generator only)</div>
          {selectedProject?.owners?.length ? (
            <ul className="list-disc pl-5 text-sm">
              {selectedProject.owners.map((o, idx) => (
                <li key={idx}>
                  {o.name} {o.position ? `(${o.position})` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm opacity-60">ยังไม่ได้เลือกโครงการ</div>
          )}
        </div>

        {/* หมายเหตุ admin comment */}
        <div className="text-sm">
          <span className="font-semibold">หมายเหตุ:</span> “ความเห็นของผู้ควบคุมงาน (COMMENTS)” ให้กรอกในแท็บ{" "}
          <span className="font-semibold">Comment</span> เท่านั้น (และผู้กรอกต้องเป็น admin)
        </div>
      </div>

      {/* ===== Section: WEATHER / WORKING TIME (ตามหัวข้อหน้าแรก) ===== */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold">สภาพอากาศ / เวลาทำงาน</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-1">สภาพอากาศ (WEATHER)</label>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
            >
              <option>ท้องฟ้าแจ่มใส</option>
              <option>มีเมฆมาก</option>
              <option>ฝนตก</option>
              <option>ฝนตกหนัก</option>
              <option>หมอก</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">เวลาเริ่มงาน</label>
            <input
              type="time"
              className="w-full rounded-lg border px-3 py-2"
              value={workingTimeStart}
              onChange={(e) => setWorkingTimeStart(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">เวลาสิ้นสุดงาน</label>
            <input
              type="time"
              className="w-full rounded-lg border px-3 py-2"
              value={workingTimeEnd}
              onChange={(e) => setWorkingTimeEnd(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* ===== Section: WORK PERFORMED TODAY (ตามหัวข้อหน้าแรก) ===== */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">รายละเอียดการปฏิบัติงานที่ทำได้ (WORK PERFORMED TODAY)</h2>
          <button type="button" onClick={addWorkRow} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            + เพิ่มรายการงาน
          </button>
        </div>

        <div className="space-y-3">
          {workPerformed.map((row, idx) => (
            <div key={row.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">รายการที่ {idx + 1}</div>
                {workPerformed.length > 1 && (
                  <button type="button" onClick={() => removeWorkRow(row.id)} className="text-sm text-red-600 hover:underline">
                    ลบ
                  </button>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField
                  label="รายการ (DESCRIPTION)"
                  value={row.description}
                  onChange={(v) => setWorkPerformed((prev) => prev.map((x) => (x.id === row.id ? { ...x, description: v } : x)))}
                />
                <TextField
                  label="บริเวณที่ทำงาน (LOCATIONS)"
                  value={row.location}
                  onChange={(v) => setWorkPerformed((prev) => prev.map((x) => (x.id === row.id ? { ...x, location: v } : x)))}
                />
                <TextField
                  label="ปริมาณ (QUANTITY)"
                  value={row.quantity}
                  onChange={(v) => setWorkPerformed((prev) => prev.map((x) => (x.id === row.id ? { ...x, quantity: v } : x)))}
                  placeholder='เช่น "120 ตร.ม."'
                />
                <TextField
                  label="วัสดุนำเข้าหน่วยงาน (MATERIAL DELIVERED TO SITE)"
                  value={row.materialDelivered}
                  onChange={(v) => setWorkPerformed((prev) => prev.map((x) => (x.id === row.id ? { ...x, materialDelivered: v } : x)))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Section: MANPOWER (ตามหัวข้อหน้าแรก) ===== */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">บุคลากรของผู้รับจ้าง (CONTRACTORS)</h2>
          <button type="button" onClick={addManpowerRow} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            + เพิ่มบุคลากร
          </button>
        </div>

        <div className="space-y-3">
          {manpower.map((row, idx) => (
            <div key={row.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">แถวที่ {idx + 1}</div>
                {manpower.length > 1 && (
                  <button type="button" onClick={() => removeManpowerRow(row.id)} className="text-sm text-red-600 hover:underline">
                    ลบ
                  </button>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <TextField
                  label="ตำแหน่ง"
                  value={row.position}
                  onChange={(v) => setManpower((prev) => prev.map((x) => (x.id === row.id ? { ...x, position: v } : x)))}
                />
                <NumberField
                  label="เช้า"
                  value={row.morning}
                  onChange={(n) => setManpower((prev) => prev.map((x) => (x.id === row.id ? { ...x, morning: n } : x)))}
                />
                <NumberField
                  label="บ่าย"
                  value={row.afternoon}
                  onChange={(n) => setManpower((prev) => prev.map((x) => (x.id === row.id ? { ...x, afternoon: n } : x)))}
                />
                <NumberField
                  label="ล่วงเวลา"
                  value={row.overtime}
                  onChange={(n) => setManpower((prev) => prev.map((x) => (x.id === row.id ? { ...x, overtime: n } : x)))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Section: EQUIPMENT (ตามหัวข้อหน้าแรก) ===== */}
      <div className="rounded-xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">เครื่องจักรกล (MAJOR EQUIPMENT ON PROJECT)</h2>
          <button type="button" onClick={addEquipmentRow} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            + เพิ่มเครื่องจักร
          </button>
        </div>

        <div className="space-y-3">
          {equipment.map((row, idx) => (
            <div key={row.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">แถวที่ {idx + 1}</div>
                {equipment.length > 1 && (
                  <button type="button" onClick={() => removeEquipmentRow(row.id)} className="text-sm text-red-600 hover:underline">
                    ลบ
                  </button>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextField
                  label="ชื่อเครื่องจักร/ชนิด"
                  value={row.name}
                  onChange={(v) => setEquipment((prev) => prev.map((x) => (x.id === row.id ? { ...x, name: v } : x)))}
                />
                <NumberField
                  label="จำนวน"
                  value={row.qty}
                  onChange={(n) => setEquipment((prev) => prev.map((x) => (x.id === row.id ? { ...x, qty: n } : x)))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Section: ISSUES (ตามหัวข้อหน้าแรก) ===== */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">ปัญหาและอุปสรรค</h2>
          <button type="button" onClick={addIssue} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            + เพิ่มปัญหา
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {issues.map((issue, idx) => (
            <div key={issue.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">ปัญหาที่ {idx + 1}</div>
                {issues.length > 1 && (
                  <button type="button" onClick={() => removeIssue(issue.id)} className="text-sm text-red-600 hover:underline">
                    ลบ
                  </button>
                )}
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-2">รูปภาพปัญหา</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm"
                    onChange={(e) => updateIssueImage(issue.id, e.target.files?.[0])}
                  />
                  {issue.imageDataUrl && (
                    <div className="mt-3">
                      <img
                        src={issue.imageDataUrl}
                        alt={`issue-${idx + 1}`}
                        className="w-full max-h-52 object-contain rounded-lg border"
                      />
                      <button
                        type="button"
                        className="mt-2 text-sm text-red-600 hover:underline"
                        onClick={() => updateIssueImage(issue.id, undefined)}
                      >
                        ลบรูป
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">รายละเอียด</label>
                  <textarea
                    className="w-full min-h-36 rounded-lg border px-3 py-2"
                    value={issue.detail}
                    onChange={(e) => updateIssueDetail(issue.id, e.target.value)}
                    placeholder="อธิบายปัญหา/อุปสรรค และผลกระทบ (ถ้ามี)..."
                  />
                  <div className="mt-1 text-xs opacity-60">
                    * ถ้าไม่กรอกอะไรเลย รายการนี้จะไม่ถูกส่งไปหน้า Preview
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Section: SAFETY NOTE (ตามหัวข้อหน้าแรก) ===== */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">บันทึกด้านความปลอดภัยในการทำงาน</h2>
        <textarea
          className="w-full min-h-28 rounded-lg border px-3 py-2"
          value={safetyNote}
          onChange={(e) => setSafetyNote(e.target.value)}
          placeholder="เช่น PPE, งานที่มีความเสี่ยง, อุบัติเหตุ/เกือบเกิดอุบัติเหตุ, วิธีป้องกัน..."
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
      >
        Submit → Preview / Print
      </button>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input className="w-full rounded-lg border px-3 py-2 bg-gray-50" value={value} readOnly />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        className="w-full rounded-lg border px-3 py-2"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        className="w-full rounded-lg border px-3 py-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}
