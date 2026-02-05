"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** ✅ Type ให้ตรงกับ /api/projects และ meta jsonb */
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

  // ✅ options จาก meta jsonb (ถ้ามี)
  contractorNameOptions?: string[];
  contractorPositionOptions?: string[];
  subContractorPositionOptions?: string[];
  equipmentTypeOptions?: string[];
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
  projectMeta: ProjectMeta;

  date: string; // ✅ เก็บ ISO สำหรับระบบเดิม (yyyy-mm-dd)
  dateBE: string; // ✅ แสดงผลแบบ พ.ศ.

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
      className="w-full rounded-lg border px-3 py-2 bg-background"
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

/** ✅ Dropdown + อื่นๆ (เลือกอื่นๆแล้วพิมพ์ได้) */
function SelectOrOther({
  label,
  value,
  onChange,
  options,
  placeholder = "เลือก...",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const normalized = options.filter(Boolean);
  const isKnown = value ? normalized.includes(value) : true;
  const [mode, setMode] = useState<"select" | "other">(isKnown ? "select" : "other");

  useEffect(() => {
    const nowKnown = value ? normalized.includes(value) : true;
    setMode(nowKnown ? "select" : "other");
  }, [value, normalized.join("|")]);

  return (
    <div>
      <label className="text-xs opacity-70">{label}</label>

      {mode === "select" ? (
        <select
          className="w-full rounded-lg border px-3 py-2 bg-background"
          value={value || ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__OTHER__") {
              setMode("other");
              onChange("");
            } else {
              onChange(v);
            }
          }}
        >
          <option value="">{placeholder}</option>
          {normalized.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
          <option value="__OTHER__">อื่นๆ</option>
        </select>
      ) : (
        <div className="grid gap-2">
          <input
            className="w-full rounded-lg border px-3 py-2 bg-background"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="พิมพ์เอง..."
          />
          <button
            type="button"
            className="text-xs underline opacity-80 hover:opacity-100 text-left"
            onClick={() => {
              setMode("select");
              onChange("");
            }}
          >
            กลับไปเลือกจากรายการ
          </button>
        </div>
      )}
    </div>
  );
}

/** ✅ แสดงผลวันที่แบบ พ.ศ. DD/MM/BBBB */
function toBE(isoYmd: string) {
  // isoYmd: yyyy-mm-dd
  const [y, m, d] = isoYmd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return "";
  const be = y + 543;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${dd}/${mm}/${be}`;
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

  // ✅ เก็บแบบ ISO เพื่อให้ระบบเดิม + weather ทำงาน
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const dateBE = useMemo(() => toBE(date), [date]);

  // weather auto (สำรอง)
  const [tempMaxC, setTempMaxC] = useState<number | null>(null);
  const [tempMinC, setTempMinC] = useState<number | null>(null);

  // Contractors
  const [contractors, setContractors] = useState<ContractorRow[]>([
    { id: uid(), name: "", position: "", qty: 0 },
  ]);

  // Sub Contractors
  const [subContractors, setSubContractors] = useState<SubContractorRow[]>([
    { id: uid(), position: "", morning: 0, afternoon: 0, overtime: 0 },
  ]);

  // Major Equipment
  const [majorEquipment, setMajorEquipment] = useState<MajorEquipmentRow[]>([
    { id: uid(), type: "", morning: 0, afternoon: 0, overtime: 0 },
  ]);

  // Work performed
  const [workPerformed, setWorkPerformed] = useState<WorkRow[]>([
    { id: uid(), desc: "", location: "", qty: "", unit: "", materialDelivered: "" },
  ]);

  // Issues (ไม่บังคับแล้ว)
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
      // ✅ ถ้าเอารูปออก ให้เคลียร์รายละเอียดด้วย (เพราะห้ามกรอกรายละเอียดถ้าไม่มีรูป)
      updateRow(setIssues, id, { detail: "" } as any);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    updateRow(setIssues, id, { imageDataUrl: dataUrl } as any);
  }

  /** ✅ รวมยอดอัตโนมัติ */
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

  // ✅ options: เอาจาก meta ของโครงการที่เลือกอยู่ ถ้าไม่มีให้มี “อื่นๆ” อย่างเดียว (SelectOrOther จะใส่ให้เอง)
  const contractorNameOptions = useMemo(
    () => (project?.contractorNameOptions && project.contractorNameOptions.length ? project.contractorNameOptions : []),
    [project]
  );
  const contractorPositionOptions = useMemo(
    () =>
      project?.contractorPositionOptions && project.contractorPositionOptions.length
        ? project.contractorPositionOptions
        : [],
    [project]
  );
  const subContractorPositionOptions = useMemo(
    () =>
      project?.subContractorPositionOptions && project.subContractorPositionOptions.length
        ? project.subContractorPositionOptions
        : [],
    [project]
  );
  const equipmentTypeOptions = useMemo(
    () => (project?.equipmentTypeOptions && project.equipmentTypeOptions.length ? project.equipmentTypeOptions : []),
    [project]
  );

  const canSubmit = useMemo(() => {
    if (!projectId) return false;
    if (!date) return false;

    // ✅ issues ไม่บังคับ แต่ถ้ามีรูป => ต้องมีรายละเอียด
    for (const it of issues) {
      if (it.imageDataUrl && !it.detail.trim()) return false;
    }
    return true;
  }, [projectId, date, issues]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!project) {
      alert("❌ กรุณาเลือกโครงการก่อน");
      return;
    }

    // ✅ ตรวจซ้ำ: ถ้ามีรูป ต้องมีรายละเอียด
    const bad = issues.find((x) => x.imageDataUrl && !x.detail.trim());
    if (bad) {
      alert("❌ หากแนบรูปใน 'ปัญหาและอุปสรรค' ต้องกรอกรายละเอียดด้วย");
      return;
    }

    const payload: DailyReportPayload = {
      projectId,
      projectMeta: project,

      date, // yyyy-mm-dd
      dateBE, // DD/MM/BBBB (พ.ศ.)

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
    <div className="mx-auto w-full max-w-6xl px-3 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold mb-4">Daily report</h1>

      {/* โครงการ (DB) */}
      <div className="rounded-xl border bg-card p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">ชื่อโครงการ</label>

            <select
              className="w-full rounded-lg border px-4 py-3 bg-background hover:opacity-90 disabled:opacity-50"
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

          </div>

          <div>
            <label className="block text-sm font-medium mb-1">วัน/เดือน/ปี พ.ศ.</label>

            {/* ✅ กล่องแสดงผลเป็น พ.ศ. แต่ให้เลือกจาก date picker ได้ */}
            <div className="relative">
              <input
                className="w-full rounded-lg border px-4 py-3 bg-background text-lg"
                value={dateBE}
                readOnly
              />
              <input
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="text-xs opacity-60 mt-1">
              (สำรอง) อุณหภูมิรายวัน: สูงสุด {tempMaxC ?? "-"}°C / ต่ำสุด {tempMinC ?? "-"}°C
            </div>
          </div>
        </div>

        {project && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
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
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold mb-3">ส่วนโครงการ (PROJECT TEAM)</h2>

          {/* Contractors */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">ผู้รับเหมา (CONTRACTORS)</div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm hover:opacity-90"
                onClick={() => addRow(setContractors, { id: uid(), name: "", position: "", qty: 0 })}
              >
                + เพิ่มแถว
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {contractors.map((r, idx) => (
                <div key={r.id} className="grid grid-cols-1 gap-3 md:grid-cols-12 items-end rounded-lg border p-3">
                  <div className="md:col-span-1 text-sm font-semibold">#{idx + 1}</div>

                  <div className="md:col-span-4">
                    <SelectOrOther
                      label="รายชื่อ"
                      value={r.name}
                      onChange={(v) => updateRow(setContractors, r.id, { name: v } as any)}
                      options={contractorNameOptions}
                      placeholder="เลือกรายชื่อ..."
                    />
                  </div>

                  <div className="md:col-span-4">
                    <SelectOrOther
                      label="ตำแหน่ง"
                      value={r.position}
                      onChange={(v) => updateRow(setContractors, r.id, { position: v } as any)}
                      options={contractorPositionOptions}
                      placeholder="เลือกตำแหน่ง..."
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

              <div className="text-sm font-semibold">รวม: {contractorTotal}</div>
            </div>
          </div>

          {/* Sub Contractors */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">ผู้รับเหมารายย่อย (SUB CONTRACTORS)</div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm hover:opacity-90"
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
                    <SelectOrOther
                      label="ตำแหน่ง"
                      value={r.position}
                      onChange={(v) => updateRow(setSubContractors, r.id, { position: v } as any)}
                      options={subContractorPositionOptions}
                      placeholder="เลือกตำแหน่ง..."
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
                รวม: เช้า {subTotals.morning} | บ่าย {subTotals.afternoon} | ล่วงเวลา {subTotals.overtime}
              </div>
            </div>
          </div>

          {/* Major Equipment */}
          <div>
            <div className="flex items-center justify-between">
              <div className="font-semibold">เครื่องจักรหลัก (MAJOR EQUIPMENT)</div>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm hover:opacity-90"
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
                    <SelectOrOther
                      label="ชนิด"
                      value={r.type}
                      onChange={(v) => updateRow(setMajorEquipment, r.id, { type: v } as any)}
                      options={equipmentTypeOptions}
                      placeholder="เลือกชนิด..."
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
                รวม: เช้า {equipTotals.morning} | บ่าย {equipTotals.afternoon} | ล่วงเวลา {equipTotals.overtime}
              </div>
            </div>
          </div>
        </div>

        {/* WORK PERFORMED */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">รายละเอียดของงานที่ได้ดำเนินงานทำแล้ว (WORK PERFORMED)</h2>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:opacity-90"
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
                    className="w-full rounded-lg border px-3 py-2 bg-background"
                    value={r.desc}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { desc: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="text-xs opacity-70">บริเวณ (LOCATIONS)</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 bg-background"
                    value={r.location}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { location: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-xs opacity-70">จำนวน</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 bg-background"
                    value={r.qty}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { qty: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="text-xs opacity-70">หน่วย</label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 bg-background"
                    value={r.unit}
                    onChange={(e) => updateRow(setWorkPerformed, r.id, { unit: e.target.value } as any)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs opacity-70">วัสดุนำเข้า
                    <span className="text-xs opacity-70">(MATERIAL DELIVERED)</span>
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 bg-background"
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
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">ปัญหาและอุปสรรค </h2>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:opacity-90"
              onClick={() => addRow(setIssues, { id: uid(), detail: "", imageDataUrl: "" })}
            >
              + เพิ่มปัญหา
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {issues.map((issue, idx) => {
              const hasImage = Boolean(issue.imageDataUrl);

              return (
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
                      <label className="block text-sm font-semibold mb-2">รูปภาพปัญหา (ถ้ามี)</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="block w-full text-sm"
                        onChange={(e) => updateIssueImage(issue.id, e.target.files?.[0])}
                      />

                      {hasImage && (
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
                      <label className="block text-sm font-semibold mb-2">
                        รายละเอียด 
                      </label>
                      <textarea
                        className="w-full min-h-36 rounded-lg border px-3 py-2 bg-background disabled:opacity-50"
                        value={issue.detail}
                        onChange={(e) => updateRow(setIssues, issue.id, { detail: e.target.value } as any)}
                        placeholder={hasImage ? "อธิบายปัญหา/อุปสรรค..." : "แนบรูปก่อนถึงจะกรอกรายละเอียดได้"}
                        disabled={!hasImage}
                        required={hasImage}
                      />
                      {hasImage && !issue.detail.trim() && (
                        <div className="text-xs text-red-600 mt-2">* เมื่อแนบรูป ต้องใส่รายละเอียด</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SAFETY */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold mb-3">บันทึกความปลอดภัย</h2>
          <div className="mt-2">
            <label className="block text-sm font-semibold mb-1">บันทึกด้านความปลอดภัยในการทำงาน</label>
            <textarea
              className="w-full min-h-28 rounded-lg border px-3 py-2 bg-background"
              value={safetyNote}
              onChange={(e) => setSafetyNote(e.target.value)}
              placeholder="เช่น PPE, งานเสี่ยง, มาตรการป้องกัน..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg border px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
