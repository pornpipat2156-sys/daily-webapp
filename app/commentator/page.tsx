// app/commentator/page.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ProjectRow = { id: string; projectName: string };
type ReportRow = { id: string; date: string }; // ISO string

type Author = { id: string; email: string; name: string | null; role: string };
type IssueComment = { id: string; comment: string; createdAt: string; author: Author };
type Issue = { id: string; detail: string; imageUrl: string | null; createdAt: string; comments: IssueComment[] };

type Supervisor = { name: string; role: string };

type ProjectMeta = {
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

type ContractorRow = { id: string; name: string; position: string; qty: number };
type SubContractorRow = { id: string; position: string; morning: number; afternoon: number; overtime: number };
type MajorEquipmentRow = { id: string; type: string; morning: number; afternoon: number; overtime: number };
type WorkRow = { id: string; desc: string; location: string; qty: string; unit: string; materialDelivered: string };

type ReportDetail = {
  id: string;
  projectId: string;
  date: string;
  projectName: string;

  projectMeta: ProjectMeta | null;
  issues: Issue[];

  contractors?: ContractorRow[];
  subContractors?: SubContractorRow[];
  majorEquipment?: MajorEquipmentRow[];
  workPerformed?: WorkRow[];
  safetyNote?: string;

  tempMaxC?: number | null;
  tempMinC?: number | null;
};

function formatDateBE(yyyyMmDdOrIso?: string) {
  if (!yyyyMmDdOrIso) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDdOrIso)) {
    const [yStr, mStr, dStr] = yyyyMmDdOrIso.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return `${dStr}/${mStr}/${yStr}`;
    const be = y + 543;
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${be}`;
  }

  const d = new Date(yyyyMmDdOrIso);
  if (Number.isNaN(d.getTime())) return yyyyMmDdOrIso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

function norm(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function padArray<T>(arr: T[], targetLen: number, makeEmpty: (idx: number) => T): T[] {
  const out = [...arr];
  while (out.length < targetLen) out.push(makeEmpty(out.length));
  return out.slice(0, targetLen);
}

const A4_WIDTH_PX = 794; // ~210mm @96dpi
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

// ===== Weather helpers (เหมือน preview) =====
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
  const dateOnly = String(dateISO || "").includes("T") ? String(dateISO).slice(0, 10) : String(dateISO);

  const lat = 18.7883;
  const lon = 98.9853;
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,weathercode` +
    `&timezone=Asia%2FBangkok` +
    `&start_date=${dateOnly}&end_date=${dateOnly}`;

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

/** ✅ issue ที่ถูกลบ/แก้ไขโดยผู้กรอก (archived) — ห้ามเอามาปนในตารางหลัก */
function isArchivedIssue(it: Issue) {
  const d = norm(it?.detail || "");
  return d.includes("รายการนี้ถูกลบ/แก้ไขโดยผู้กรอก") || d.includes("ถูกลบ/แก้ไขโดยผู้กรอก");
}

/** ✅ NEW: normalize report ให้รองรับทั้ง
 * - API ส่ง field ฟอร์มมาแบบ top-level (แนะนำ)
 * - หรือเก่า ๆ ที่ยังอยู่ใน report.payload
 */
function normalizeReport(raw: any): ReportDetail {
  const payload = raw?.payload && typeof raw.payload === "object" ? raw.payload : {};

  const projectMeta: ProjectMeta | null =
    (raw?.projectMeta && typeof raw.projectMeta === "object" ? raw.projectMeta : null) ??
    (payload?.projectMeta && typeof payload.projectMeta === "object" ? payload.projectMeta : null) ??
    null;

  return {
    id: String(raw?.id || ""),
    projectId: String(raw?.projectId || payload?.projectId || ""),
    date: String(raw?.date || payload?.date || ""),
    projectName: String(raw?.projectName || payload?.projectName || ""),

    projectMeta,
    issues: Array.isArray(raw?.issues) ? raw.issues : Array.isArray(payload?.issues) ? payload.issues : [],

    contractors: Array.isArray(raw?.contractors)
      ? raw.contractors
      : Array.isArray(payload?.contractors)
      ? payload.contractors
      : [],
    subContractors: Array.isArray(raw?.subContractors)
      ? raw.subContractors
      : Array.isArray(payload?.subContractors)
      ? payload.subContractors
      : [],
    majorEquipment: Array.isArray(raw?.majorEquipment)
      ? raw.majorEquipment
      : Array.isArray(payload?.majorEquipment)
      ? payload.majorEquipment
      : [],
    workPerformed: Array.isArray(raw?.workPerformed)
      ? raw.workPerformed
      : Array.isArray(payload?.workPerformed)
      ? payload.workPerformed
      : [],
    safetyNote:
      typeof raw?.safetyNote === "string" ? raw.safetyNote : typeof payload?.safetyNote === "string" ? payload.safetyNote : "",

    tempMaxC: raw?.tempMaxC ?? payload?.tempMaxC ?? null,
    tempMinC: raw?.tempMinC ?? payload?.tempMinC ?? null,
  };
}

export default function CommentatorPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportId, setReportId] = useState<string>("");

  const [detail, setDetail] = useState<ReportDetail | null>(null);

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [err, setErr] = useState<string>("");

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [submittingAll, setSubmittingAll] = useState(false);

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loadingSup, setLoadingSup] = useState(false);

  const [tempMax, setTempMax] = useState<number | null>(null);
  const [tempMin, setTempMin] = useState<number | null>(null);
  const [wMorning, setWMorning] = useState<string>("-");
  const [wAfternoon, setWAfternoon] = useState<string>("-");
  const [wOvertime, setWOvertime] = useState<string>("-");
  const [wxLoading, setWxLoading] = useState(false);

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

  // 1) load projects
  useEffect(() => {
    let cancel = false;
    async function run() {
      setLoadingProjects(true);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        const list: ProjectRow[] = Array.isArray(json)
          ? json.map((p: any) => ({ id: String(p.id), projectName: String(p.projectName || p.name || "") }))
          : [];

        if (!cancel) setProjects(list);
      } catch {
        if (!cancel) setProjects([]);
      } finally {
        if (!cancel) setLoadingProjects(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, []);

  // 2) prefill จาก sessionStorage (ถ้าเด้งมาจาก preview)
  useEffect(() => {
    const rid = sessionStorage.getItem("lastSubmittedReportId") || "";
    const pid = sessionStorage.getItem("lastSubmittedProjectId") || "";
    if (pid) setProjectId(pid);
    if (rid) setReportId(rid);
  }, []);

  // 3) load reports for selected project
  useEffect(() => {
    let cancel = false;
    async function run() {
      setReports([]);
      if (!projectId) return;

      setLoadingReports(true);
      try {
        const res = await fetch(`/api/daily-reports?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const list: ReportRow[] = Array.isArray(json?.reports)
          ? json.reports.map((r: any) => ({ id: String(r.id), date: String(r.date) }))
          : [];

        if (!cancel) setReports(list);
      } catch {
        if (!cancel) setReports([]);
      } finally {
        if (!cancel) setLoadingReports(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [projectId]);

  // 4) load report detail when reportId changes
  useEffect(() => {
    let cancel = false;
    async function run() {
      setErr("");
      setDetail(null);
      setDraft({});

      if (!reportId) return;

      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลดรายงานไม่สำเร็จ");

        if (!cancel) {
          const rep = normalizeReport(json.report);
          setDetail(rep);

          // ✅ initDraft เฉพาะ issues ที่ยัง active (ไม่เอา archived มาปน)
          const initDraft: Record<string, string> = {};
          const active = (rep?.issues || []).filter((x) => !isArchivedIssue(x));
          for (const it of active) initDraft[it.id] = "";
          setDraft(initDraft);
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? "โหลดรายงานไม่สำเร็จ");
      } finally {
        if (!cancel) setLoadingDetail(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  // 5) load supervisors from DB meta.supervisors (DB เท่านั้น)
  useEffect(() => {
    let cancel = false;

    async function run() {
      setErr("");
      setSupervisors([]);
      if (!projectId) return;

      setLoadingSup(true);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลด supervisors ไม่สำเร็จ");

        const raw = json.project?.meta?.supervisors;
        const arr = Array.isArray(raw) ? raw : [];

        const looksLikeRole = (s: string) => /(ผู้|หัวหน้า|ผอ|วิศวกร|ผู้ตรวจ|ผู้ออกแบบ|ผู้ควบคุม|ผู้แทน)/.test(s);

        const sup: Supervisor[] = arr
          .map((x: any) => {
            if (x && typeof x === "object") {
              return { name: String(x?.name || "").trim(), role: String(x?.role || "").trim() };
            }
            const s = String(x || "").trim();
            if (!s) return { name: "", role: "" };
            return looksLikeRole(s) ? { name: "", role: s } : { name: s, role: "" };
          })
          .filter((x) => x.name || x.role);

        if (!cancel) setSupervisors(sup);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? "โหลด supervisors ไม่สำเร็จ");
      } finally {
        if (!cancel) setLoadingSup(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [projectId]);

  // ✅ overtime detection เหมือน preview (อิงจากข้อมูลรายงานใน DB)
  const hasOvertime = useMemo(() => {
    const subOt = (detail?.subContractors || []).some((r) => (Number(r.overtime) || 0) > 0);
    const eqOt = (detail?.majorEquipment || []).some((r) => (Number(r.overtime) || 0) > 0);
    return Boolean(subOt || eqOt);
  }, [detail?.subContractors, detail?.majorEquipment]);

  // ✅ Weather fetch เหมือน preview (ดึงจาก Open-Meteo แล้วคำนวณช่วงเวลา)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!detail?.date) return;

      setWxLoading(true);
      try {
        const hourly = await fetchHourlyWeather(detail.date);

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
          setTempMax(detail.tempMaxC ?? null);
          setTempMin(detail.tempMinC ?? null);
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
  }, [detail?.date, hasOvertime, detail?.tempMaxC, detail?.tempMinC]);

  const canShowReport = Boolean(projectId && reportId && detail);

  // ✅ แยก issues เป็น active/archived
  const activeIssues = useMemo(() => (detail?.issues || []).filter((x) => !isArchivedIssue(x)), [detail?.issues]);
  const archivedIssues = useMemo(() => (detail?.issues || []).filter((x) => isArchivedIssue(x)), [detail?.issues]);

  const issueCount = useMemo(() => activeIssues.length, [activeIssues]);

  // ✅ ต้องนับ “ครบคอมเมนต์” เฉพาะ active เท่านั้น (ของที่ถูกลบ/แก้ไขไม่ต้องนับ)
  const allIssuesHaveAtLeastOneComment = useMemo(() => {
    if (!activeIssues.length) return true;
    return activeIssues.every((it) => (it.comments || []).length > 0);
  }, [activeIssues]);

  async function postComment(issueId: string) {
    const text = (draft[issueId] || "").trim();
    if (!text) return;

    setPosting((m) => ({ ...m, [issueId]: true }));
    setErr("");

    try {
      const res = await fetch(`/api/issues/${encodeURIComponent(issueId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message || "ส่งความเห็นไม่สำเร็จ");

      const again = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
      const againJson = await again.json().catch(() => null);
      if (again.ok && againJson?.ok) setDetail(normalizeReport(againJson.report));

      setDraft((m) => ({ ...m, [issueId]: "" }));
    } catch (e: any) {
      setErr(e?.message ?? "ส่งความเห็นไม่สำเร็จ");
    } finally {
      setPosting((m) => ({ ...m, [issueId]: false }));
    }
  }

  async function submitAllAndGoNext() {
    setErr("");
    if (!detail) return;

    if (!allIssuesHaveAtLeastOneComment) {
      setErr("ยังแสดงความคิดเห็นไม่ครบทุกปัญหา กรุณาใส่ความเห็นให้ครบก่อนกดส่ง");
      return;
    }

    setSubmittingAll(true);
    try {
      sessionStorage.setItem("lastCommentedReportId", detail.id);
      router.push("/summation");
    } finally {
      setSubmittingAll(false);
    }
  }

  // ====== prepare preview layout data ======
  const pm = detail?.projectMeta || {};
  const contractors = detail?.contractors || [];
  const subContractors = detail?.subContractors || [];
  const majorEquipment = detail?.majorEquipment || [];
  const workPerformed = detail?.workPerformed || [];
  const safetyNote = detail?.safetyNote || "";

  const maxRows = Math.max(contractors.length, subContractors.length, majorEquipment.length, 1);

  const contractorsPadded = useMemo(
    () =>
      padArray<ContractorRow>(contractors, maxRows, (i) => ({
        id: `EMPTY-C-${i}`,
        name: "-",
        position: "-",
        qty: 0,
      })),
    [contractors, maxRows]
  );

  const subPadded = useMemo(
    () =>
      padArray<SubContractorRow>(subContractors, maxRows, (i) => ({
        id: `EMPTY-S-${i}`,
        position: "-",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [subContractors, maxRows]
  );

  const equipPadded = useMemo(
    () =>
      padArray<MajorEquipmentRow>(majorEquipment, maxRows, (i) => ({
        id: `EMPTY-E-${i}`,
        type: "-",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [majorEquipment, maxRows]
  );

  const contractorTotal = useMemo(() => contractors.reduce((s, r) => s + (Number(r.qty) || 0), 0), [contractors]);

  const subTotals = useMemo(() => {
    return {
      morning: subContractors.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: subContractors.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: subContractors.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [subContractors]);

  const equipTotals = useMemo(() => {
    return {
      morning: majorEquipment.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: majorEquipment.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: majorEquipment.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [majorEquipment]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-3 md:px-6 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">การแสดงความคิดเห็น</div>
            <div className="text-sm opacity-70">
              เลือกโครงการ → เลือกรายงาน → แสดงความคิดเห็น “ในฟอร์มรายงาน” → กดส่งเพื่อไป “การตรวจสอบและการอนุมัติ”
            </div>
          </div>
          <button className="rounded-lg border px-3 py-2" onClick={() => router.push("/daily-report")}>
            กลับไปกรอก Daily report
          </button>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-sm font-medium mb-1">เลือกโครงการ</div>
              <select
                className="w-full rounded-lg border px-3 py-2 bg-background"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setReportId("");
                  setDetail(null);
                }}
                disabled={loadingProjects}
              >
                <option value="">{loadingProjects ? "กำลังโหลด..." : "— เลือกโครงการ —"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">เลือกรายงาน (วันที่)</div>
              <select
                className="w-full rounded-lg border px-3 py-2 bg-background"
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                disabled={!projectId || loadingReports}
              >
                <option value="">
                  {!projectId ? "— เลือกโครงการก่อน —" : loadingReports ? "กำลังโหลด..." : "— เลือกรายงาน —"}
                </option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatDateBE(r.date)}
                  </option>
                ))}
              </select>
              <div className="text-xs opacity-70 mt-1">ถ้าเด้งมาจาก Preview ระบบจะเลือกให้อัตโนมัติ (report ล่าสุดที่เพิ่งส่ง)</div>
            </div>

            <div className="flex items-end">
              <button
                className="w-full rounded-lg border px-3 py-2 disabled:opacity-60"
                disabled={!canShowReport || submittingAll}
                onClick={submitAllAndGoNext}
                title="ต้องแสดงความคิดเห็นครบทุกปัญหาก่อน"
              >
                {submittingAll ? "กำลังส่ง..." : "ส่ง → ไปการตรวจสอบและการอนุมัติ"}
              </button>
            </div>
          </div>

          {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
        </div>

        <div className="mt-4">
          {!reportId ? null : loadingDetail ? (
            <div className="rounded-xl border bg-card p-4 opacity-80">กำลังโหลดข้อมูลรายงาน...</div>
          ) : !detail ? (
            <div className="rounded-xl border bg-card p-4 opacity-80">ยังไม่พบข้อมูลรายงาน</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  สถานะความเห็น:{" "}
                  <span className={allIssuesHaveAtLeastOneComment ? "text-green-600" : "text-amber-600"}>
                    {allIssuesHaveAtLeastOneComment ? "ครบแล้ว" : "ยังไม่ครบ"}
                  </span>
                </div>
                <div className="text-sm opacity-70">จำนวนปัญหา (ปัจจุบัน): {issueCount}</div>
              </div>

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
                                  <Image src="/logo.png" alt="Company Logo" width={110} height={110} className="w-full h-full object-contain" priority />
                                </div>
                              </td>

                              <td className="cellCenter titleBar">
                                <div className="hMain">รายงานการควบคุมงานก่อสร้างประจำวัน (DAILY REPORT)</div>
                                <div className="mt-1 hSub">ประจำวันที่ {formatDateBE(detail.date)}</div>
                                <div className="mt-1 hSub">โครงการ : {detail.projectName}</div>
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
                              <td className="cell">{pm.contractNo || "-"}</td>
                              <td className="cell">สถานที่ก่อสร้าง</td>
                              <td className="cell">{pm.siteLocation || "-"}</td>
                            </tr>
                            <tr>
                              <td className="cell">บันทึกแนบท้ายที่</td>
                              <td className="cell">{pm.annexNo || "-"}</td>
                              <td className="cell">วงเงินค่าก่อสร้าง</td>
                              <td className="cell">{pm.contractValue || "-"}</td>
                            </tr>
                            <tr>
                              <td className="cell">เริ่มสัญญา</td>
                              <td className="cell">{pm.contractStart ? formatDateBE(pm.contractStart) : "-"}</td>
                              <td className="cell">ผู้รับจ้าง</td>
                              <td className="cell">{pm.contractorName || "-"}</td>
                            </tr>
                            <tr>
                              <td className="cell">สิ้นสุดสัญญา</td>
                              <td className="cell">{pm.contractEnd ? formatDateBE(pm.contractEnd) : "-"}</td>
                              <td className="cell">จัดจ้างโดยวิธี</td>
                              <td className="cell">{pm.procurementMethod || "-"}</td>
                            </tr>
                            <tr>
                              <td className="cell">จำนวนงวด</td>
                              <td className="cell">{pm.installmentCount ?? "-"}</td>
                              <td className="cell">รวมเวลาก่อสร้าง</td>
                              <td className="cell">{pm.totalDurationDays != null ? `${pm.totalDurationDays} วัน` : "-"}</td>
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
                            <div className="border-2 border-black bg-yellow-50 p-2 text-sm mb-2">{pm.dailyReportNo || "-"}</div>
                            <div className="border-2 border-black bg-yellow-50 p-2 text-sm mb-2">{pm.periodNo || "-"}</div>
                            <div className="border-2 border-black bg-yellow-50 p-2 text-sm">{pm.weekNo || "-"}</div>
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
                            {(workPerformed.length
                              ? workPerformed
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

                      {/* ===================== ISSUES (active เท่านั้น) ===================== */}
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
                            {activeIssues.length === 0 ? (
                              <tr>
                                <td className="cell" colSpan={3}>
                                  <div className="opacity-70">รายงานนี้ไม่มี “ปัญหาและอุปสรรค” (ปัจจุบัน)</div>
                                </td>
                              </tr>
                            ) : (
                              activeIssues.map((it, idx) => (
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
                                    <div className="text-sm font-semibold mb-2">ความเห็นของผู้ควบคุมงาน</div>

                                    <textarea
                                      className="w-full rounded-lg border p-2 text-sm bg-white"
                                      style={{ minHeight: 90 }}
                                      placeholder="พิมพ์ความเห็น..."
                                      value={draft[it.id] ?? ""}
                                      onChange={(e) => setDraft((m) => ({ ...m, [it.id]: e.target.value }))}
                                    />

                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <div className="text-xs opacity-70">ความเห็นเดิม: {(it.comments || []).length} รายการ</div>
                                      <button
                                        className="rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
                                        disabled={posting[it.id] || !(draft[it.id] || "").trim()}
                                        onClick={() => postComment(it.id)}
                                      >
                                        {posting[it.id] ? "กำลังส่ง..." : "ส่งความเห็น"}
                                      </button>
                                    </div>

                                    {(it.comments || []).length > 0 ? (
                                      <div className="mt-3 rounded-xl border p-2">
                                        <div className="text-sm font-medium mb-2">รายการความเห็น ({it.comments.length})</div>
                                        <div className="space-y-2">
                                          {it.comments.map((c) => (
                                            <div key={c.id} className="rounded-lg border p-2">
                                              <div className="text-xs opacity-70">
                                                โดย {c.author?.name || c.author?.email || "-"} ({c.author?.role || "-"}) —{" "}
                                                {formatDateBE(c.createdAt)}
                                              </div>
                                              <div className="whitespace-pre-wrap text-sm mt-1">{c.comment}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* ✅ ประวัติ issue ที่ถูกลบ/แก้ไข */}
                      {archivedIssues.length ? (
                        <div className="box mt-4">
                          <div className="subBar cell">ประวัติ “ปัญหา/อุปสรรค” ที่ถูกลบหรือแก้ไข</div>
                          <div className="cell">
                            <div className="text-sm opacity-70 mb-2">
                              ส่วนนี้เป็นประวัติ เพื่อไม่ให้ “ความเห็นเดิม” หายไป แต่จะไม่ถูกนับเป็นปัญหาปัจจุบัน
                            </div>

                            <div className="space-y-3">
                              {archivedIssues.map((it, i) => (
                                <div key={it.id} className="rounded-xl border p-3">
                                  <div className="text-sm font-semibold">รายการเดิม #{i + 1}</div>
                                  <div className="text-sm mt-1 whitespace-pre-wrap">{it.detail || "-"}</div>

                                  {(it.comments || []).length ? (
                                    <div className="mt-2 rounded-xl border p-2">
                                      <div className="text-sm font-medium mb-2">รายการความเห็น ({it.comments.length})</div>
                                      <div className="space-y-2">
                                        {it.comments.map((c) => (
                                          <div key={c.id} className="rounded-lg border p-2">
                                            <div className="text-xs opacity-70">
                                              โดย {c.author?.name || c.author?.email || "-"} ({c.author?.role || "-"}) —{" "}
                                              {formatDateBE(c.createdAt)}
                                            </div>
                                            <div className="whitespace-pre-wrap text-sm mt-1">{c.comment}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs opacity-70 mt-2">ไม่มีความเห็น</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
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
                            {loadingSup ? <div className="opacity-70">กำลังโหลดรายชื่อ...</div> : <SignatureGrid items={supervisors} />}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
