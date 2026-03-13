// app/daily-report/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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

  /** ✅ พิกัดสถานที่ก่อสร้างจาก Project.meta */
  siteLatitude?: number | null;
  siteLongitude?: number | null;

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

type WeatherOption = "sunny" | "cloudy" | "rainy" | "storm" | "foggy" | "";

type DailyReportPayload = {
  projectId: string;
  projectMeta: ProjectMeta;

  date: string; // ✅ เก็บ ISO สำหรับระบบเดิม (yyyy-mm-dd)
  dateBE: string; // ✅ แสดงผลแบบ พ.ศ.

  tempMaxC: number | null;
  tempMinC: number | null;

  /** ✅ ผู้ใช้เลือกเอง */
  weatherMorning?: WeatherOption;
  weatherAfternoon?: WeatherOption;
  weatherEvening?: WeatherOption;

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

/** ✅ (แก้ปัญหามือถือ) บีบอัด/ย่อรูปก่อนแปลงเป็น dataURL เพื่อลดขนาด sessionStorage */
async function compressImageToDataUrl(
  file: File,
  opts?: { maxSize?: number; quality?: number }
): Promise<string> {
  const maxSize = opts?.maxSize ?? 1280; // px
  const quality = opts?.quality ?? 0.75; // 0..1

  if (!file.type.startsWith("image/")) return fileToDataUrl(file);

  const srcDataUrl = await fileToDataUrl(file);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = srcDataUrl;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return srcDataUrl;

  const scale = Math.min(1, maxSize / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));

  if (scale >= 1) return srcDataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;

  const ctx = canvas.getContext("2d");
  if (!ctx) return srcDataUrl;

  ctx.drawImage(img, 0, 0, nw, nh);

  try {
    const out = canvas.toDataURL("image/jpeg", quality);
    return out || srcDataUrl;
  } catch {
    return srcDataUrl;
  }
}

/** ✅ คำนวณ weekNo / periodNo / annexNo / dailyReportNo อัตโนมัติจากวันเริ่ม-สิ้นสุดสัญญา + วันที่รายงาน */
function computeAutoMeta(p: ProjectMeta, reportDate: string) {
  function parseISODateOnly(iso: string) {
    const [y, m, d] = (iso || "").split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  const s = parseISODateOnly(p.contractStart);
  const e = parseISODateOnly(p.contractEnd);
  const r = parseISODateOnly(reportDate);

  if (!s || !e || !r) {
    return {
      weekNo: p.weekNo,
      annexNo: "1",
      periodNo: p.periodNo,
      dailyReportNo: p.dailyReportNo,
    };
  }

  const totalDaysByDates = Math.max(
    1,
    Math.floor((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
  const totalDays = Number.isFinite(totalDaysByDates)
    ? totalDaysByDates
    : Math.max(1, p.totalDurationDays || 1);

  const rawDayNo = Math.floor((r.getTime() - s.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const dayNo = clamp(rawDayNo, 1, totalDays);

  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const weekIndex = clamp(Math.floor((dayNo - 1) / 7) + 1, 1, totalWeeks);

  const installmentCount = Math.max(1, Math.floor(p.installmentCount || 1));
  const periodLen = totalDays / installmentCount;
  const periodIndex = clamp(Math.ceil(dayNo / periodLen), 1, installmentCount);

  return {
    weekNo: `สัปดาห์ ${weekIndex}/${totalWeeks}`,
    annexNo: "1",
    periodNo: `งวด ${periodIndex}/${installmentCount}`,
    dailyReportNo: `${dayNo}/${totalDays}`,
  };
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isValidLatitude(lat: number | null) {
  return lat !== null && lat >= -90 && lat <= 90;
}

function isValidLongitude(lon: number | null) {
  return lon !== null && lon >= -180 && lon <= 180;
}

/** ✅ อุณหภูมิรายวันจากพิกัดโครงการ */
async function fetchDailyTemp(yyyyMmDd: string, latInput?: unknown, lonInput?: unknown) {
  const lat = parseCoordinate(latInput);
  const lon = parseCoordinate(lonInput);

  if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
    return { max: null, min: null };
  }

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SoftSection({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="soft-card rounded-[26px] p-4 sm:p-5 lg:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        {badge ? (
          <span className="inline-flex w-fit items-center rounded-full border border-white/60 bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.16))] px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm dark:text-slate-100">
            {badge}
          </span>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "blue" | "mint" | "pink" | "amber" | "violet";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300"
      : tone === "pink"
      ? "bg-[rgba(247,199,217,0.18)] text-rose-700 dark:text-rose-300"
      : tone === "amber"
      ? "bg-[rgba(243,190,114,0.18)] text-amber-700 dark:text-amber-300"
      : tone === "violet"
      ? "bg-[rgba(154,135,245,0.18)] text-violet-700 dark:text-violet-300"
      : "bg-[rgba(124,156,245,0.16)] text-blue-700 dark:text-blue-300";

  return (
    <div className={cn("rounded-[22px] px-4 py-3", toneClass)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{label}</div>
      <div className="mt-1 break-words text-sm font-bold">{value}</div>
    </div>
  );
}

function RowCard({
  index,
  onRemove,
  children,
  removeLabel = "ลบ",
}: {
  index: number;
  onRemove?: () => void;
  children: React.ReactNode;
  removeLabel?: string;
}) {
  return (
    <div className="rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(251,252,255,0.9))] p-4 shadow-[0_8px_24px_rgba(148,163,184,0.08)] dark:bg-[linear-gradient(180deg,rgba(17,28,44,0.92),rgba(22,33,49,0.92))]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow-sm dark:bg-slate-700">
            {index}
          </span>
          รายการ {index}
        </div>

        {onRemove ? (
          <button
            type="button"
            className="soft-btn rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        ) : null}
      </div>

      {children}
    </div>
  );
}

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
      className="soft-input h-12 w-full px-4 text-sm text-slate-700 hover:bg-white dark:text-slate-100"
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
      <FieldLabel>{label}</FieldLabel>

      {mode === "select" ? (
        <select
          className="soft-input h-12 w-full px-4 text-sm text-slate-700 hover:bg-white dark:text-slate-100"
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
            className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="พิมพ์เอง..."
          />
          <button
            type="button"
            className="w-fit text-xs font-semibold text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
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

function WeatherSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: WeatherOption;
  onChange: (value: WeatherOption) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        className="soft-input h-12 w-full px-4 text-sm text-slate-700 hover:bg-white dark:text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value as WeatherOption)}
      >
        <option value="">เลือกสภาพอากาศ</option>
        <option value="sunny">แดดออก</option>
        <option value="cloudy">มีเมฆมาก</option>
        <option value="rainy">ฝนตก</option>
        <option value="storm">พายุฝนฟ้าคะนอง</option>
        <option value="foggy">หมอก</option>
      </select>
    </div>
  );
}

function toBE(isoYmd: string) {
  const [y, m, d] = isoYmd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return "";
  const be = y + 543;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${dd}/${mm}/${be}`;
}

function isoToDateOnly(isoYmd: string) {
  const [y, m, d] = (isoYmd || "").split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function dateToISODateOnly(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DateBEInput = React.forwardRef<HTMLInputElement, any>(function DateBEInput(props, ref) {
  const { value, onClick, onKeyDown } = props;
  return (
    <input
      ref={ref}
      className="soft-input h-12 w-full cursor-pointer px-4 text-base font-semibold text-slate-700 dark:text-slate-100 sm:text-[17px]"
      value={value || ""}
      readOnly
      onClick={onClick}
      onKeyDown={onKeyDown}
      inputMode="none"
      aria-label="เลือกวันที่"
    />
  );
});

export default function DailyReportPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string>("");

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId]
  );

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const dateBE = useMemo(() => toBE(date), [date]);

  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    isoToDateOnly(new Date().toISOString().slice(0, 10))
  );
  useEffect(() => {
    setSelectedDate(isoToDateOnly(date));
  }, [date]);

  const [dateOpen, setDateOpen] = useState(false);

  const autoMeta = useMemo(() => {
    if (!project || !date) return null;
    return computeAutoMeta(project, date);
  }, [project, date]);

  const [tempMaxC, setTempMaxC] = useState<number | null>(null);
  const [tempMinC, setTempMinC] = useState<number | null>(null);

  const [weatherMorning, setWeatherMorning] = useState<WeatherOption>("");
  const [weatherAfternoon, setWeatherAfternoon] = useState<WeatherOption>("");
  const [weatherEvening, setWeatherEvening] = useState<WeatherOption>("");

  const [contractors, setContractors] = useState<ContractorRow[]>([
    { id: uid(), name: "", position: "", qty: 0 },
  ]);

  const [subContractors, setSubContractors] = useState<SubContractorRow[]>([
    { id: uid(), position: "", morning: 0, afternoon: 0, overtime: 0 },
  ]);

  const [majorEquipment, setMajorEquipment] = useState<MajorEquipmentRow[]>([
    { id: uid(), type: "", morning: 0, afternoon: 0, overtime: 0 },
  ]);

  const [workPerformed, setWorkPerformed] = useState<WorkRow[]>([
    { id: uid(), desc: "", location: "", qty: "", unit: "", materialDelivered: "" },
  ]);

  const [issues, setIssues] = useState<IssueRow[]>([{ id: uid(), detail: "", imageDataUrl: "" }]);

  const [safetyNote, setSafetyNote] = useState("");

  function resetForm() {
    setEditingReportId(null);

    setTempMaxC(null);
    setTempMinC(null);

    setWeatherMorning("");
    setWeatherAfternoon("");
    setWeatherEvening("");

    setContractors([{ id: uid(), name: "", position: "", qty: 0 }]);
    setSubContractors([{ id: uid(), position: "", morning: 0, afternoon: 0, overtime: 0 }]);
    setMajorEquipment([{ id: uid(), type: "", morning: 0, afternoon: 0, overtime: 0 }]);
    setWorkPerformed([{ id: uid(), desc: "", location: "", qty: "", unit: "", materialDelivered: "" }]);
    setIssues([{ id: uid(), detail: "", imageDataUrl: "" }]);
    setSafetyNote("");
  }

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoadingProjects(true);
        const res = await fetch("/api/projects", { cache: "no-store" });
        const data: ProjectMeta[] = await res.json();

        if (!alive) return;
        setProjects(Array.isArray(data) ? data : []);

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

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!projectId || !date) return;

      const res = await fetch(
        `/api/daily-reports/by-date?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(date)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => null);
      if (!alive) return;
      if (!json?.ok) return;

      if (!json.reportId) {
        resetForm();
        return;
      }

      setEditingReportId(String(json.reportId));

      const p = json.payload || {};

      setTempMaxC(p.tempMaxC ?? null);
      setTempMinC(p.tempMinC ?? null);

      setWeatherMorning((p.weatherMorning ?? "") as WeatherOption);
      setWeatherAfternoon((p.weatherAfternoon ?? "") as WeatherOption);
      setWeatherEvening((p.weatherEvening ?? "") as WeatherOption);

      setContractors(
        Array.isArray(p.contractors) && p.contractors.length
          ? p.contractors
          : [{ id: uid(), name: "", position: "", qty: 0 }]
      );

      setSubContractors(
        Array.isArray(p.subContractors) && p.subContractors.length
          ? p.subContractors
          : [{ id: uid(), position: "", morning: 0, afternoon: 0, overtime: 0 }]
      );

      setMajorEquipment(
        Array.isArray(p.majorEquipment) && p.majorEquipment.length
          ? p.majorEquipment
          : [{ id: uid(), type: "", morning: 0, afternoon: 0, overtime: 0 }]
      );

      setWorkPerformed(
        Array.isArray(p.workPerformed) && p.workPerformed.length
          ? p.workPerformed
          : [{ id: uid(), desc: "", location: "", qty: "", unit: "", materialDelivered: "" }]
      );

      setSafetyNote(String(p.safetyNote || ""));

      const dbIssues = Array.isArray(json.issues) ? json.issues : [];
      setIssues(
        dbIssues.length
          ? dbIssues.map((it: any) => ({
              id: String(it.id),
              detail: String(it.detail || ""),
              imageDataUrl: String(it.imageUrl || ""),
            }))
          : [{ id: uid(), detail: "", imageDataUrl: "" }]
      );
    }

    run();
    return () => {
      alive = false;
    };
  }, [projectId, date]);

  useEffect(() => {
    let alive = true;

    if (editingReportId) return;
    if (!project || !date) return;

    fetchDailyTemp(date, project.siteLatitude, project.siteLongitude)
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
  }, [date, editingReportId, project]);

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
      updateRow(setIssues, id, { detail: "" } as any);
      return;
    }

    const dataUrl = await compressImageToDataUrl(file, { maxSize: 1280, quality: 0.75 });
    updateRow(setIssues, id, { imageDataUrl: dataUrl } as any);
  }

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

  const contractorNameOptions = useMemo(
    () =>
      project?.contractorNameOptions && project.contractorNameOptions.length
        ? project.contractorNameOptions
        : [],
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
    () =>
      project?.equipmentTypeOptions && project.equipmentTypeOptions.length
        ? project.equipmentTypeOptions
        : [],
    [project]
  );

  const canSubmit = useMemo(() => {
    if (!projectId) return false;
    if (!date) return false;

    for (const it of issues) {
      if (it.imageDataUrl && !it.detail.trim()) return false;
    }
    return true;
  }, [projectId, date, issues]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!project) {
      alert("❌ กรุณาเลือกโครงการก่อน");
      return;
    }

    const bad = issues.find((x) => x.imageDataUrl && !x.detail.trim());
    if (bad) {
      alert("❌ หากแนบรูปใน 'ปัญหาและอุปสรรค' ต้องกรอกรายละเอียดด้วย");
      return;
    }

    const patchedProjectMeta: ProjectMeta = {
      ...project,
      weekNo: autoMeta?.weekNo ?? project.weekNo,
      annexNo: autoMeta?.annexNo ?? "1",
      periodNo: autoMeta?.periodNo ?? project.periodNo,
      dailyReportNo: autoMeta?.dailyReportNo ?? project.dailyReportNo,
    };

    const payload: DailyReportPayload = {
      projectId,
      projectMeta: patchedProjectMeta,
      date,
      dateBE,
      tempMaxC,
      tempMinC,
      weatherMorning,
      weatherAfternoon,
      weatherEvening,
      contractors,
      subContractors,
      majorEquipment,
      workPerformed,
      issues,
      safetyNote,
    };

    const res = await fetch("/api/daily-reports/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      alert("❌ บันทึกลง DB ไม่สำเร็จ");
      return;
    }

    const reportId = String(json.reportId);
    setEditingReportId(reportId);

    sessionStorage.setItem("lastSubmittedReportId", reportId);
    sessionStorage.setItem("lastSubmittedProjectId", projectId);

    router.push(`/daily-report/preview?reportId=${encodeURIComponent(reportId)}`);
  }

  const hasValidProjectCoords = useMemo(() => {
    if (!project) return false;
    return isValidLatitude(parseCoordinate(project.siteLatitude)) &&
      isValidLongitude(parseCoordinate(project.siteLongitude));
  }, [project]);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-8 sm:px-4 lg:px-6">
      <div className="mb-5 rounded-[30px] bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.14),rgba(247,199,217,0.16))] p-5 shadow-[0_14px_38px_rgba(148,163,184,0.10)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Daily Report
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              รายงานประจำวัน
            </h1>
            <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              กรุณากรอกฟอร์มข้อมูลรายงานประจำวันให้ครบถ้วนและถูกต้อง
            </div>
          </div>

          <div
            className={cn(
              "inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm",
              editingReportId
                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                editingReportId ? "bg-blue-500" : "bg-amber-500"
              )}
            />
            {editingReportId
              ? "โหมดแก้ไข: มีรายงานของวันที่นี้ในระบบแล้ว"
              : "โหมดสร้างใหม่: ยังไม่มีรายงานของวันที่นี้"}
          </div>
        </div>
      </div>

      <SoftSection
        title="ข้อมูลโครงการ"
        subtitle="เลือกโครงการและวันที่รายงาน พร้อมดูข้อมูลสัญญาโดยสรุป"
        badge="Project Setup"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* ฝั่งซ้าย */}
          <div>
            <FieldLabel>ชื่อโครงการ</FieldLabel>

            <select
              className="soft-input h-12 w-full px-4 text-sm text-slate-700 hover:bg-white disabled:opacity-50 dark:text-slate-100"
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

            {/* Desktop only: ย้ายสภาพอากาศมาไว้ใต้กล่องเลือกโครงการ */}
            <div className="mt-3 hidden md:block">
              <div className="grid gap-3 md:grid-cols-3">
                <WeatherSelect
                  label="สภาพอากาศช่วงเช้า"
                  value={weatherMorning}
                  onChange={setWeatherMorning}
                />
                <WeatherSelect
                  label="สภาพอากาศช่วงบ่าย"
                  value={weatherAfternoon}
                  onChange={setWeatherAfternoon}
                />
                <WeatherSelect
                  label="สภาพอากาศล่วงเวลา"
                  value={weatherEvening}
                  onChange={setWeatherEvening}
                />
              </div>
            </div>
          </div>

          {/* ฝั่งขวา */}
          <div>
            <FieldLabel>วัน/เดือน/ปี พ.ศ.</FieldLabel>

            <div className="[&_.react-datepicker]:rounded-[22px] [&_.react-datepicker]:border [&_.react-datepicker]:border-slate-200 [&_.react-datepicker]:bg-white [&_.react-datepicker]:shadow-[0_18px_40px_rgba(148,163,184,0.16)] [&_.react-datepicker__day--selected]:!bg-[var(--primary)] [&_.react-datepicker__day--keyboard-selected]:!bg-[rgba(124,156,245,0.18)] [&_.react-datepicker__header]:rounded-t-[22px] [&_.react-datepicker__header]:border-b [&_.react-datepicker__header]:border-slate-200 [&_.react-datepicker__header]:bg-slate-50">
              <DatePicker
                selected={selectedDate}
                onChange={(d: Date | null) => {
                  if (!d) return;
                  setSelectedDate(d);
                  setDate(dateToISODateOnly(d));
                  setDateOpen(false);
                }}
                open={dateOpen}
                onClickOutside={() => setDateOpen(false)}
                onSelect={() => setDateOpen(false)}
                onInputClick={() => setDateOpen(true)}
                showPopperArrow={false}
                popperPlacement="bottom-start"
                popperProps={{ strategy: "fixed" }}
                dateFormat="dd/MM/yyyy"
                customInput={<DateBEInput value={dateBE} />}
              />
            </div>

            <div className="mt-2 rounded-2xl bg-[rgba(124,156,245,0.10)] px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              อุณหภูมิรายวัน: สูงสุด {tempMaxC ?? "-"}°C / ต่ำสุด {tempMinC ?? "-"}°C
            </div>

            {!hasValidProjectCoords && project ? (
              <div className="mt-2 rounded-2xl bg-[rgba(243,190,114,0.18)] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                โครงการนี้ยังไม่มีพิกัดสถานที่ก่อสร้างในระบบ จึงยังไม่สามารถดึงอุณหภูมิอัตโนมัติได้
              </div>
            ) : null}

            {/* Mobile only: คงตำแหน่งเดิมไว้ */}
            <div className="mt-3 grid gap-3 md:hidden sm:grid-cols-3">
              <WeatherSelect
                label="ช่วงเช้า"
                value={weatherMorning}
                onChange={setWeatherMorning}
              />
              <WeatherSelect
                label="ช่วงบ่าย"
                value={weatherAfternoon}
                onChange={setWeatherAfternoon}
              />
              <WeatherSelect
                label="ล่วงเวลา"
                value={weatherEvening}
                onChange={setWeatherEvening}
              />
            </div>

            {project && autoMeta && (
              <div className="mt-2 rounded-2xl bg-[rgba(121,217,199,0.10)] px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                เลขอัตโนมัติ: {autoMeta.weekNo} | {autoMeta.periodNo} | รายงาน{" "}
                {autoMeta.dailyReportNo} | ภาคผนวก {autoMeta.annexNo}
              </div>
            )}
          </div>
        </div>

        {project && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="สัญญาจ้าง" value={project.contractNo || "-"} tone="blue" />
            <StatCard label="ผู้รับจ้าง" value={project.contractorName || "-"} tone="mint" />
            <StatCard label="สถานที่ก่อสร้าง" value={project.siteLocation || "-"} tone="pink" />
          </div>
        )}
      </SoftSection>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <SoftSection
          title="ส่วนโครงการ (PROJECT TEAM)"
          subtitle="ข้อมูลบุคลากรและเครื่องจักรของวันทำงาน"
          badge="Team"
        >
          <div className="mb-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                ผู้รับเหมา (CONTRACTORS)
              </div>
              <button
                type="button"
                className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
                onClick={() => addRow(setContractors, { id: uid(), name: "", position: "", qty: 0 })}
              >
                + เพิ่มแถว
              </button>
            </div>

            <div className="space-y-4">
              {contractors.map((r, idx) => (
                <RowCard
                  key={r.id}
                  index={idx + 1}
                  onRemove={
                    contractors.length > 1 ? () => removeRow(setContractors, r.id) : undefined
                  }
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <SelectOrOther
                        label="รายชื่อ"
                        value={r.name}
                        onChange={(v) => updateRow(setContractors, r.id, { name: v } as any)}
                        options={contractorNameOptions}
                        placeholder="เลือกรายชื่อ..."
                      />
                    </div>

                    <div className="md:col-span-5">
                      <SelectOrOther
                        label="ตำแหน่ง"
                        value={r.position}
                        onChange={(v) => updateRow(setContractors, r.id, { position: v } as any)}
                        options={contractorPositionOptions}
                        placeholder="เลือกตำแหน่ง..."
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>จำนวน</FieldLabel>
                      <QtySelect
                        value={r.qty}
                        onChange={(n) => updateRow(setContractors, r.id, { qty: n } as any)}
                      />
                    </div>
                  </div>
                </RowCard>
              ))}

              <div className="rounded-[22px] bg-[rgba(124,156,245,0.10)] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                รวม: {contractorTotal}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                ผู้รับเหมารายย่อย (SUB CONTRACTORS)
              </div>
              <button
                type="button"
                className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
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

            <div className="space-y-4">
              {subContractors.map((r, idx) => (
                <RowCard
                  key={r.id}
                  index={idx + 1}
                  onRemove={
                    subContractors.length > 1 ? () => removeRow(setSubContractors, r.id) : undefined
                  }
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <SelectOrOther
                        label="ตำแหน่ง"
                        value={r.position}
                        onChange={(v) => updateRow(setSubContractors, r.id, { position: v } as any)}
                        options={subContractorPositionOptions}
                        placeholder="เลือกตำแหน่ง..."
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>ช่วงเช้า (เลือกจำนวน)</FieldLabel>
                      <QtySelect
                        value={r.morning}
                        onChange={(n) => updateRow(setSubContractors, r.id, { morning: n } as any)}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>ช่วงบ่าย (เลือกจำนวน)</FieldLabel>
                      <QtySelect
                        value={r.afternoon}
                        onChange={(n) =>
                          updateRow(setSubContractors, r.id, { afternoon: n } as any)
                        }
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>ล่วงเวลา (เลือกจำนวน)</FieldLabel>
                      <QtySelect
                        value={r.overtime}
                        onChange={(n) =>
                          updateRow(setSubContractors, r.id, { overtime: n } as any)
                        }
                      />
                    </div>
                  </div>
                </RowCard>
              ))}

              <div className="rounded-[22px] bg-[rgba(121,217,199,0.12)] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                รวม: เช้า {subTotals.morning} | บ่าย {subTotals.afternoon} | ล่วงเวลา{" "}
                {subTotals.overtime}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                เครื่องจักรหลัก (MAJOR EQUIPMENT)
              </div>
              <button
                type="button"
                className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
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

            <div className="space-y-4">
              {majorEquipment.map((r, idx) => (
                <RowCard
                  key={r.id}
                  index={idx + 1}
                  onRemove={
                    majorEquipment.length > 1 ? () => removeRow(setMajorEquipment, r.id) : undefined
                  }
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <SelectOrOther
                        label="ชนิด"
                        value={r.type}
                        onChange={(v) => updateRow(setMajorEquipment, r.id, { type: v } as any)}
                        options={equipmentTypeOptions}
                        placeholder="เลือกชนิด..."
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>ช่วงเช้า (เลือกจำนวน)</FieldLabel>
                      <QtySelect
                        value={r.morning}
                        onChange={(n) => updateRow(setMajorEquipment, r.id, { morning: n } as any)}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>ช่วงบ่าย (เลือกจำนวน)</FieldLabel>
                      <QtySelect
                        value={r.afternoon}
                        onChange={(n) =>
                          updateRow(setMajorEquipment, r.id, { afternoon: n } as any)
                        }
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>ล่วงเวลา (เลือกจำนวน)</FieldLabel>
                      <QtySelect
                        value={r.overtime}
                        onChange={(n) =>
                          updateRow(setMajorEquipment, r.id, { overtime: n } as any)
                        }
                      />
                    </div>
                  </div>
                </RowCard>
              ))}

              <div className="rounded-[22px] bg-[rgba(247,199,217,0.16)] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                รวม: เช้า {equipTotals.morning} | บ่าย {equipTotals.afternoon} | ล่วงเวลา{" "}
                {equipTotals.overtime}
              </div>
            </div>
          </div>
        </SoftSection>

        <SoftSection
          title="รายละเอียดของงานที่ได้ดำเนินงานทำแล้ว (WORK PERFORMED)"
          subtitle="รายการงานที่ดำเนินการในวันนั้น"
          badge="Execution"
        >
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-bold text-slate-800 dark:text-slate-100">
              รายการงาน
            </div>
            <button
              type="button"
              className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
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

          <div className="space-y-4">
            {workPerformed.map((r, idx) => (
              <RowCard
                key={r.id}
                index={idx + 1}
                onRemove={
                  workPerformed.length > 1 ? () => removeRow(setWorkPerformed, r.id) : undefined
                }
                removeLabel="ลบแถวนี้"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <FieldLabel>รายการ (DESCRIPTION)</FieldLabel>
                    <input
                      className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                      value={r.desc}
                      onChange={(e) => updateRow(setWorkPerformed, r.id, { desc: e.target.value } as any)}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <FieldLabel>บริเวณ (LOCATIONS)</FieldLabel>
                    <input
                      className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                      value={r.location}
                      onChange={(e) =>
                        updateRow(setWorkPerformed, r.id, { location: e.target.value } as any)
                      }
                    />
                  </div>

                  <div className="md:col-span-1">
                    <FieldLabel>จำนวน</FieldLabel>
                    <input
                      className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                      value={r.qty}
                      onChange={(e) => updateRow(setWorkPerformed, r.id, { qty: e.target.value } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FieldLabel>หน่วย</FieldLabel>
                    <input
                      className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                      value={r.unit}
                      onChange={(e) => updateRow(setWorkPerformed, r.id, { unit: e.target.value } as any)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FieldLabel>วัสดุนำเข้า (MATERIAL)</FieldLabel>
                    <input
                      className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                      value={r.materialDelivered}
                      onChange={(e) =>
                        updateRow(setWorkPerformed, r.id, { materialDelivered: e.target.value } as any)
                      }
                    />
                  </div>
                </div>
              </RowCard>
            ))}
          </div>
        </SoftSection>

        <SoftSection
          title="ปัญหาและอุปสรรค"
          subtitle="เพิ่มรูปและคำอธิบายเมื่อพบปัญหาในหน้างาน"
          badge="Issues"
        >
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-bold text-slate-800 dark:text-slate-100">
              รายการปัญหา
            </div>
            <button
              type="button"
              className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
              onClick={() => addRow(setIssues, { id: uid(), detail: "", imageDataUrl: "" })}
            >
              + เพิ่มปัญหา
            </button>
          </div>

          <div className="space-y-4">
            {issues.map((issue, idx) => {
              const hasImage = Boolean(issue.imageDataUrl);

              return (
                <div
                  key={issue.id}
                  className="rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(251,252,255,0.92))] p-4 shadow-[0_8px_24px_rgba(148,163,184,0.08)] dark:bg-[linear-gradient(180deg,rgba(17,28,44,0.92),rgba(22,33,49,0.92))]"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(239,127,150,0.12)] px-3 py-1.5 text-sm font-bold text-rose-700 dark:text-rose-300">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow-sm dark:bg-slate-700">
                        {idx + 1}
                      </span>
                      ปัญหาที่ {idx + 1}
                    </div>

                    {issues.length > 1 && (
                      <button
                        type="button"
                        className="soft-btn rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                        onClick={() => removeRow(setIssues, issue.id)}
                      >
                        ลบ
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <FieldLabel>รูปภาพปัญหา (ถ้ามี)</FieldLabel>
                      <div className="rounded-[22px] border border-dashed border-border bg-slate-50/70 p-4 dark:bg-slate-900/40">
                        <input
                          type="file"
                          accept="image/*"
                          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-2xl file:border file:border-border file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-50 dark:text-slate-100 dark:file:bg-slate-900 dark:file:text-slate-100"
                          onChange={(e) => updateIssueImage(issue.id, e.target.files?.[0])}
                        />

                        {hasImage && (
                          <div className="mt-4">
                            <img
                              src={issue.imageDataUrl}
                              alt={`issue-${idx + 1}`}
                              className="w-full rounded-[20px] border border-border bg-background object-contain"
                            />
                            <button
                              type="button"
                              className="soft-btn mt-3 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                              onClick={() => updateIssueImage(issue.id, undefined)}
                            >
                              ลบรูป
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <FieldLabel>รายละเอียด</FieldLabel>
                      <textarea
                        className="soft-input min-h-40 w-full px-4 py-3 text-sm leading-6 text-slate-700 placeholder:text-slate-400 disabled:opacity-50 dark:text-slate-100"
                        value={issue.detail}
                        onChange={(e) => updateRow(setIssues, issue.id, { detail: e.target.value } as any)}
                        placeholder={hasImage ? "อธิบายปัญหา/อุปสรรค..." : "แนบรูปก่อนถึงจะกรอกรายละเอียดได้"}
                        disabled={!hasImage}
                        required={hasImage}
                      />
                      {hasImage && !issue.detail.trim() && (
                        <div className="mt-2 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
                          * เมื่อแนบรูป ต้องใส่รายละเอียด
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SoftSection>

        <SoftSection
          title="บันทึกความปลอดภัย"
          subtitle="บันทึกเรื่อง PPE งานเสี่ยง และมาตรการป้องกัน"
          badge="Safety"
        >
          <div>
            <FieldLabel>บันทึกด้านความปลอดภัยในการทำงาน</FieldLabel>
            <textarea
              className="soft-input min-h-32 w-full px-4 py-3 text-sm leading-6 text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
              value={safetyNote}
              onChange={(e) => setSafetyNote(e.target.value)}
              placeholder="เช่น PPE, งานเสี่ยง, มาตรการป้องกัน..."
            />
          </div>
        </SoftSection>

        <div className="sticky bottom-3 z-20 flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="soft-btn inline-flex min-h-12 items-center justify-center rounded-[20px] border border-primary/25 bg-[linear-gradient(135deg,rgba(124,156,245,0.96),rgba(121,217,199,0.96))] px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(124,156,245,0.24)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11"
          >
            ยืนยัน
          </button>
        </div>
      </form>
    </div>
  );
}