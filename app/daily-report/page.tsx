"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** ✅ Type ให้ตรงกับ /api/projects ที่คุณทำไว้ */
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

type SubContractorRow = {
  id: string;
  position: string;
  morning: number;
  afternoon: number;
  overtime: number;
};

type MajorEquipmentRow = {
  id: string;
  type: string;
  morning: number;
  afternoon: number;
  overtime: number;
};

type WorkRow = {
  id: string;
  desc: string;
  location: string;
  qty: string;
  unit: string;
  materialDelivered: string;
};

type IssueRow = {
  id: string;
  detail: string;
  imageDataUrl: string;
};

type DailyReportPayload = {
  projectId: string;
  projectMeta: ProjectMeta; // ✅ แนบไปเลย เพื่อให้ preview ไม่ต้อง lookup อีก

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

/** อุณหภูมิรายวัน (กันพังไว้ก่อน) */
async function fetchDailyTemp(yyyyMmDd: string) {
  const lat = 18.7883;
  const lon = 98.9853;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FBangkok&start_date=${yyyyMmDd}&end_date=${yyyyMmDd}`;

  const res = await fetch(url);
  if (!res.ok) return { max: null, min: null };
  const data = await res.json();

  const max = data?.daily?.temperature_2m_max?.[0];
  const min = data?.daily?.temperature_2m_min?.[0];

  return {
    max: typeof max === "number" ? max : null,
    min: typeof min === "number" ? min : null,
  };
}

/** ✅ select จำนวนแบบเลือกเท่านั้น */
function QtySelect({
  value,
  onChange,
  max = 50,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <select
      className="w-full rounded-lg border px-3 py-2"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {Array.from({ length: max + 1 }, (_, i) => (
        <option key={i} value={i}>
          {i}
        </option>
      ))}
    </select>
  );
}

export default function DailyReportPage() {
  const router = useRouter();

  // ✅ projects จาก DB
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // เลือกโครงการเท่านั้น (จาก DB)
  const [projectId, setProjectId] = useState<string>("");

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  );

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // weather auto (สำรอง)
  const [tempMaxC, setTempMaxC] = useState<number | null>(null);
  const [tempMinC, setTempMinC] = useState<number | null>(null);

  // Contractors
  const [contractors, setContractors] = useState<ContractorRow[]>([
    { id: uid(), name: "", position: "", qty: 0 },
  ]);

  // ✅ Sub Contractors (เช้า/บ่าย/ล่วงเวลา)
  const [subContractors, setSubContractors] = useState<SubContractorRow[]>([
    { id: uid(), position: "", morning: 0, afternoon: 0, overtime: 0 },
  ]);

  // ✅ Major Equipment (เช้า/บ่าย/ล่วงเวลา)
  const [majorEquipment, setMajorEquipment] = useState<MajorEquipmentRow[]>([
    { id: uid(), type: "", morning: 0, afternoon: 0, overtime: 0 },
  ]);

  // ✅ Work performed (วัสดุนำเข้า)
  const [workPerformed, setWorkPerformed] = useState<WorkRow[]>([
    { id: uid(), desc: "", location: "", qty: "", unit: "", materialDelivered: "" },
  ]);

  // Issues (ต้องมีรูป+รายละเอียด)
  const [issues, setIssues] = useState<IssueRow[]>([{ id: uid(), detail: "", imageDataUrl: "" }]);

  // Safety note
  const [safetyNote, setSafetyNote] = useState("");

  // ✅ โหลดรายการโครงการจาก DB ครั้งเดียว
  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoadingProjects(true);
        const res = await fetch("/api/projects", { cache: "no-store" });
        const data: ProjectMeta[] = await res.json();

        if (!alive) return;
        setProjects(Array.isArray(data) ? data : []);

        // set default projectId เป็นตัวแรก
        if (Array.isArray(data) && data.length > 0) {
          setProjectId((prev) => prev || data[0].id);
        }
      } catch {
        if (!alive) return;
        setProjects([]);
      } finally {
        if (alive) setLoadingProjects(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, []);

  // auto fetch daily weather when date changes (สำรอง)
  useEffect(() => {
    let alive = true;
    fetchDailyTemp(date)
      .then((t) => {
        if (!alive) return;
        setTempMaxC(t.max);
        setTempMinC(t.min);
      })
      .catch(() => {
        if (!alive) return;
        setTempMaxC(null);
        setTempMinC(null);
      });
    return () => {
      alive = false;
    };
  }, [date]);

  function addRow<T>(setFn: React.Dispatch<React.SetStateAction<T[]>>, row: T) {
    setFn((prev) => [...prev, row]);
  }
  function removeRow<T extends { id: string }>(
    setFn: React.Dispatch<React.SetStateAction<T[]>>,
    id: string
  ) {
    setFn((prev) => prev.filter((x) => x.id !== id));
  }
  function updateRow<T extends { id: string }>(
    setFn: React.Dispatch<React.SetStateAction<T[]>>,
    id: string,
    patch: Partial<T>
  ) {
    setFn((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function updateIssueImage(id: string, file?: File) {
    if (!file) {
      updateRow(setIssues, id, { imageDataUrl: "" } as any);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    updateRow(setIssues, id, { imageDataUrl: dataUrl } as any);
  }

  /** ✅ รวมยอดอัตโนมัติในแต่ละตารางย่อย */
  const contractorTotal = useMemo(
    () => contractors.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [contractors]
  );

  const subTotals = useMemo(() => {
    const morning = subContractors.reduce((s, r) => s + (Number(r.morning) || 0), 0);
    const afternoon = subContractors.reduce((s, r) => s + (Number(r.afternoon) || 0), 0);
    const overtime = subContractors.reduce((s, r) => s + (Number(r.overtime) || 0), 0);
    return { morning, afternoon, overtime };
  }, [subContractors]);

  const equipTotals = useMemo(() => {
    const morning = majorEquipment.reduce((s, r) => s + (Number(r.morning) || 0), 0);
    const afternoon = majorEquipment.reduce((s, r) => s + (Number(r.afternoon) || 0), 0);
    const overtime = majorEquipment.reduce((s, r) => s + (Number(r.overtime) || 0), 0);
    return { morning, afternoon, overtime };
  }, [majorEquipment]);

  const canSubmit = useMemo(() => {
    if (!projectId) return false;
    if (!date) return false;

    for (const it of issues) {
      if (!it.detail.trim()) return false;
      if (!it.imageDataUrl) return false;
    }
    return true;
  }, [projectId, date, issues]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!project) {
      alert("❌ กรุณาเลือกโครงการก่อน");
      return;
    }

    const badIssue = issues.find((x) => !x.detail.trim() || !x.imageDataUrl);
    if (badIssue) {
      alert("❌ 'ปัญหาและอุปสรรค' ต้องมีรูป + รายละเอียดทุกข้อ");
      return;
    }

    const payload: DailyReportPayload = {
      projectId,
      projectMeta: project, // ✅ ส่งไป preview

      date,

      tempMaxC,
      tempMinC,

      contractors,
      subContractors,
      majorEquipment,

      workPerformed,
      issues,

      safetyNote,
    };

    sessionStorage.setItem("dailyReportPayload", JSON.stringify(payload));
    router.push("/daily-report/preview");
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-4">Daily report (กรอกโดย User)</h1>

      {/* โครงการ (DB) */}
      <div className="rounded-xl border bg-white p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อโครงการ (เลือกเท่านั้น)</label>

            <select
              className="w-full rounded-lg border px-3 py-2"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={loadingProjects || projects.length === 0}
            >
              {loadingProjects ? (
                <option value="">กำลังโหลดโครงการ...</option>
              ) : projects.length === 0 ? (
                <option value="">ไม่พบโครงการในระบบ</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName}
                  </option>
                ))
              )}
            </select>

            <div className="text-xs opacity-60 mt-1">* รายชื่อโครงการมาจาก DB (ผ่าน /api/projects)</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">วันที่ (Auto default วันนี้)</label>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <div className="text-xs opacity-60 mt-1">
              (สำรอง) อุณหภูมิรายวัน: สูงสุด {tempMaxC ?? "-"}°C / ต่ำสุด {tempMinC ?? "-"}°C
            </div>
          </div>
        </div>

        {project && (
          <div className="mt-4 grid gap-2 md:grid-cols-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="opacity-60">สัญญาจ้าง</div>
              <div className="font-semibold">{project.contractNo || "-"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="opacity-60">ผู้รับจ้าง</div>
              <div className="font-semibold">{project.contractorName || "-"}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="opacity-60">สถานที่ก่อสร้าง</div>
              <div className="font-semibold">{project.siteLocation || "-"}</div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* PROJECT TEAM */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold mb-3">ส่วนโครงการ (PROJECT TEAM)</h2>

          {/* Contractors */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">CONTRACTORS</div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => addRow(setContractors, { id: uid(), name: "", position: "", qty: 0 })}
              >
                + เพิ่มแถว
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {contractors.map((r, idx) => (
                <div key={r.id} className="grid gap-2 md:grid-cols-12 items-end rounded-lg border p-3">
                  <div className="md:col-span-1 text-sm font-semibold">#{idx + 1}</div>
                  <div className="md:col-span-4">
                    <label className="text-xs opacity-70">รายชื่อ</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      value={r.name}
                      onChange={(e) => updateRow(setContractors, r.id, { name: e.target.value } as any)}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-xs opacity-70">ตำแหน่ง</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      value={r.position}
                      onChange={(e) => updateRow(setContractors, r.id, { position: e.target.value } as any)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs opacity-70">จำนวน</label>
                    <QtySelect
                      value={r.qty}
                      onChange={(n) => updateRow(setContractors, r.id, { qty: n } as any)}
                    />
                  </div>
                  <div className="md:col-span-1">
                    {contractors.length > 1 && (
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => removeRow(setContractors, r.id)}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="text-sm font-semibold">รวม (CONTRACTORS): {contractorTotal}</div>
            </div>
          </div>

          {/* Sub Contractors */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">SUB CONTRACTORS</div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() =>
                  addRow(setSubContractors, {
                    id: uid(),
                    position: "",
                    morning: 0,
                    afternoon: 0,
                    overtime: 0,
                  })
                }
              >
                + เพิ่มแถว
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {subContractors.map((r, idx) => (
                <div key={r.id} className="grid gap-2 md:grid-cols-12 items-end rounded-lg border p-3">
                  <div className="md:col-span-1 text-sm font-semibold">#{idx + 1}</div>

                  <div className="md:col-span-3">
                    <label className="text-xs opacity-70">ตำแหน่ง</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      value={r.position}
                      onChange={(e) => updateRow(setSubContractors, r.id, { position: e.target.value } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs opacity-70">ช่วงเช้า (เลือกจำนวน)</label>
                    <QtySelect
                      value={r.morning}
                      onChange={(n) => updateRow(setSubContractors, r.id, { morning: n } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs opacity-70">ช่วงบ่าย (เลือกจำนวน)</label>
                    <QtySelect
                      value={r.afternoon}
                      onChange={(n) => updateRow(setSubContractors, r.id, { afternoon: n } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs opacity-70">ล่วงเวลา (เลือกจำนวน)</label>
                    <QtySelect
                      value={r.overtime}
                      onChange={(n) => updateRow(setSubContractors, r.id, { overtime: n } as any)}
                    />
                  </div>

                  <div className="md:col-span-1">
                    {subContractors.length > 1 && (
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => removeRow(setSubContractors, r.id)}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="text-sm font-semibold">
                รวม (SUB): เช้า {subTotals.morning} | บ่าย {subTotals.afternoon} | ล่วงเวลา{" "}
                {subTotals.overtime}
              </div>
            </div>
          </div>

          {/* Major Equipment */}
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">MAJOR EQUIPMENT</div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() =>
                  addRow(setMajorEquipment, {
                    id: uid(),
                    type: "",
                    morning: 0,
                    afternoon: 0,
                    overtime: 0,
                  })
                }
              >
                + เพิ่มแถว
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {majorEquipment.map((r, idx) => (
                <div key={r.id} className="grid gap-2 md:grid-cols-12 items-end rounded-lg border p-3">
                  <div className="md:col-span-1 text-sm font-semibold">#{idx + 1}</div>

                  <div className="md:col-span-3">
                    <label className="text-xs opacity-70">ชนิด</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      value={r.type}
                      onChange={(e) => updateRow(setMajorEquipment, r.id, { type: e.target.value } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs opacity-70">ช่วงเช้า (เลือกจำนวน)</label>
                    <QtySelect
                      value={r.morning}
                      onChange={(n) => updateRow(setMajorEquipment, r.id, { morning: n } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs opacity-70">ช่วงบ่าย (เลือกจำนวน)</label>
                    <QtySelect
                      value={r.afternoon}
                      onChange={(n) => updateRow(setMajorEquipment, r.id, { afternoon: n } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs opacity-70">ล่วงเวลา (เลือกจำนวน)</label>
                    <QtySelect
                      value={r.overtime}
                      onChange={(n) => updateRow(setMajorEquipment, r.id, { overtime: n } as any)}
                    />
                  </div>

                  <div className="md:col-span-1">
                    {majorEquipment.length > 1 && (
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => removeRow(setMajorEquipment, r.id)}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="text-sm font-semibold">
                รวม (EQUIP): เช้า {equipTotals.morning} | บ่าย {equipTotals.afternoon} | ล่วงเวลา{" "}
                {equipTotals.overtime}
              </div>
            </div>
          </div>
        </div>

        {/* WORK PERFORMED */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              รายละเอียดของงานที่ได้ดำเนินงานทำแล้ว (WORK PERFORMED TODAY)
            </h2>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() =>
                addRow(setWorkPerformed, {
                  id: uid(),
                  desc: "",
                  location: "",
                  qty: "",
                  unit: "",
                  materialDelivered: "",
                })
              }
            >
              + เพิ่มแถว
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {workPerformed.map((r, idx) => (
              <div key={r.id} className="grid gap-2 md:grid-cols-12 items-end rounded-lg border p-3">
                <div className="md:col-span-1 text-sm font-semibold">#{idx + 1}</div>

                <div className="md:col-span-4">
                  <label className="text-xs opacity-70">รายการ (DESCRIPTION)</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={r.desc}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { desc: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="text-xs opacity-70">บริเวณ (LOCATIONS)</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={r.location}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { location: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-xs opacity-70">จำนวน</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={r.qty}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { qty: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-xs opacity-70">หน่วย</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={r.unit}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { unit: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs opacity-70">วัสดุนำเข้า (MATERIAL DELIVERED TO SITE)</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2"
                    value={r.materialDelivered}
                    onChange={(e) =>
                      updateRow(setWorkPerformed, r.id, { materialDelivered: e.target.value } as any)
                    }
                  />
                </div>

                <div className="md:col-span-12 flex justify-end">
                  {workPerformed.length > 1 && (
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeRow(setWorkPerformed, r.id)}
                    >
                      ลบแถวนี้
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ISSUES */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">ปัญหาและอุปสรรค (ต้องมีรูป + รายละเอียด)</h2>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => addRow(setIssues, { id: uid(), detail: "", imageDataUrl: "" })}
            >
              + เพิ่มปัญหา
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {issues.map((issue, idx) => (
              <div key={issue.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">ปัญหาที่ {idx + 1}</div>
                  {issues.length > 1 && (
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeRow(setIssues, issue.id)}
                    >
                      ลบ
                    </button>
                  )}
                </div>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold mb-2">รูปภาพปัญหา (บังคับ)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm"
                      onChange={(e) => updateIssueImage(issue.id, e.target.files?.[0])}
                    />
                    {issue.imageDataUrl ? (
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
                    ) : (
                      <div className="text-xs text-red-600 mt-2">* ต้องใส่รูป</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">รายละเอียด (บังคับ)</label>
                    <textarea
                      className="w-full min-h-36 rounded-lg border px-3 py-2"
                      value={issue.detail}
                      onChange={(e) => updateRow(setIssues, issue.id, { detail: e.target.value } as any)}
                      placeholder="อธิบายปัญหา/อุปสรรค..."
                      required
                    />
                    {!issue.detail.trim() && (
                      <div className="text-xs text-red-600 mt-2">* ต้องใส่รายละเอียด</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAFETY */}
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold mb-3">บันทึกความปลอดภัย</h2>
          <div className="mt-2">
            <label className="block text-sm font-semibold mb-1">
              บันทึกด้านความปลอดภัยในการทำงาน (กรอกโดย User)
            </label>
            <textarea
              className="w-full min-h-28 rounded-lg border px-3 py-2"
              value={safetyNote}
              onChange={(e) => setSafetyNote(e.target.value)}
              placeholder="เช่น PPE, งานเสี่ยง, มาตรการป้องกัน..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          Submit → Preview / Print
        </button>
      </form>
    </div>
  );
}
