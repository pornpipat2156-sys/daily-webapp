"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Supervisor = { name: string; role: string };

export type ContractorRow = {
  id: string;
  name: string;
  position: string;
  qty: number;
};

export type SubContractorRow = {
  id: string;
  position: string;
  morning: number;
  afternoon: number;
  overtime: number;
};

export type MajorEquipmentRow = {
  id: string;
  type: string;
  morning: number;
  afternoon: number;
  overtime: number;
};

export type WorkRow = {
  id: string;
  desc: string;
  location: string;
  qty: string;
  unit: string;
  materialDelivered: string;
};

export type IssueComment = {
  id: string;
  comment: string;
  createdAt: string;
  author?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

export type IssueRowUnified = {
  id: string;
  detail: string;
  imageUrl: string;
  comments?: IssueComment[];
};

export type ProjectMetaUnified = {
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
};

export type ReportRenderModel = {
  date: string;
  projectName: string;
  projectMeta: ProjectMetaUnified;
  contractors: ContractorRow[];
  subContractors: SubContractorRow[];
  majorEquipment: MajorEquipmentRow[];
  workPerformed: WorkRow[];
  issues: IssueRowUnified[];
  safetyNote: string;
  tempMaxC?: number | null;
  tempMinC?: number | null;
  hasOvertime?: boolean;
  supervisors: Supervisor[];
};

const A4_WIDTH_PX = 794;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateBE(isoOrYmd?: string) {
  if (!isoOrYmd) return "-";

  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const [y, m, d] = isoOrYmd.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoOrYmd;
    return `${pad2(d)}/${pad2(m)}/${y + 543}`;
  }

  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return isoOrYmd;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear() + 543}`;
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
    if (m < startMin || m > endMin) continue;
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
    if (m < startMin || m > endMin) continue;
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

function normStr(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatDateTimeThai(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAuthorLabel(author?: IssueComment["author"]) {
  if (!author) return "-";
  return author.name?.trim() || author.email?.trim() || "-";
}

function normalizeModel(raw: any): ReportRenderModel {
  const pmRaw = raw?.projectMeta ?? raw?.project_meta ?? raw?.meta ?? {};

  const pm: ProjectMetaUnified = {
    projectName: String(pmRaw?.projectName ?? raw?.projectName ?? "-"),
    contractNo: String(pmRaw?.contractNo ?? "-"),
    annexNo: String(pmRaw?.annexNo ?? "-"),
    contractStart: String(pmRaw?.contractStart ?? "-"),
    contractEnd: String(pmRaw?.contractEnd ?? "-"),
    contractorName: String(pmRaw?.contractorName ?? "-"),
    siteLocation: String(pmRaw?.siteLocation ?? "-"),
    contractValue: String(pmRaw?.contractValue ?? "-"),
    procurementMethod: String(pmRaw?.procurementMethod ?? "-"),
    installmentCount: Number(pmRaw?.installmentCount ?? 0),
    totalDurationDays: Number(pmRaw?.totalDurationDays ?? 0),
    dailyReportNo: String(pmRaw?.dailyReportNo ?? "-"),
    periodNo: String(pmRaw?.periodNo ?? "-"),
    weekNo: String(pmRaw?.weekNo ?? "-"),
  };

  const safeArr = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);

  return {
    date: String(raw?.date ?? raw?.reportDate ?? "-"),
    projectName: String(raw?.projectName ?? pm.projectName ?? "-"),
    projectMeta: pm,
    contractors: safeArr(raw?.contractors).map((x: any, i) => ({
      id: String(x?.id ?? `C-${i}`),
      name: String(x?.name ?? "-"),
      position: String(x?.position ?? "-"),
      qty: Number(x?.qty ?? 0),
    })),
    subContractors: safeArr(raw?.subContractors ?? raw?.sub_contractors).map((x: any, i) => ({
      id: String(x?.id ?? `S-${i}`),
      position: String(x?.position ?? "-"),
      morning: Number(x?.morning ?? 0),
      afternoon: Number(x?.afternoon ?? 0),
      overtime: Number(x?.overtime ?? 0),
    })),
    majorEquipment: safeArr(raw?.majorEquipment ?? raw?.major_equipment).map((x: any, i) => ({
      id: String(x?.id ?? `E-${i}`),
      type: String(x?.type ?? "-"),
      morning: Number(x?.morning ?? 0),
      afternoon: Number(x?.afternoon ?? 0),
      overtime: Number(x?.overtime ?? 0),
    })),
    workPerformed: safeArr(raw?.workPerformed ?? raw?.work_performed).map((x: any, i) => ({
      id: String(x?.id ?? `W-${i}`),
      desc: String(x?.desc ?? "-"),
      location: String(x?.location ?? "-"),
      qty: String(x?.qty ?? "-"),
      unit: String(x?.unit ?? "-"),
      materialDelivered: String(x?.materialDelivered ?? x?.material ?? "-"),
    })),
    issues: safeArr(raw?.issues).map((x: any, i) => ({
      id: String(x?.id ?? `I-${i}`),
      detail: String(x?.detail ?? ""),
      imageUrl: String(x?.imageUrl ?? x?.image_url ?? ""),
      comments: safeArr(x?.comments).map((c: any, ci) => ({
        id: String(c?.id ?? `IC-${i}-${ci}`),
        comment: String(c?.comment ?? ""),
        createdAt: String(c?.createdAt ?? new Date().toISOString()),
        author: c?.author
          ? {
              name: c.author?.name ?? null,
              email: c.author?.email ?? null,
              role: c.author?.role ?? null,
            }
          : null,
      })),
    })),
    safetyNote: String(raw?.safetyNote ?? raw?.safety_note ?? ""),
    tempMaxC: raw?.tempMaxC ?? raw?.temp_max_c ?? null,
    tempMinC: raw?.tempMinC ?? raw?.temp_min_c ?? null,
    hasOvertime: raw?.hasOvertime ?? null,
    supervisors: safeArr(raw?.supervisors).map((s: any) => ({
      name: String(s?.name ?? "-"),
      role: String(s?.role ?? "-"),
    })),
  };
}

function SectionTitle({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-extrabold tracking-tight text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {badge ? (
        <span className="rounded-full bg-[linear-gradient(135deg,rgba(124,156,245,0.18),rgba(121,217,199,0.18))] px-3 py-1 text-[11px] font-bold text-slate-700">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function MetricChip({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  tone?: "blue" | "mint" | "pink" | "amber" | "violet";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[rgba(121,217,199,0.16)] text-emerald-700"
      : tone === "pink"
      ? "bg-[rgba(247,199,217,0.20)] text-rose-700"
      : tone === "amber"
      ? "bg-[rgba(243,190,114,0.18)] text-amber-700"
      : tone === "violet"
      ? "bg-[rgba(154,135,245,0.18)] text-violet-700"
      : "bg-[rgba(124,156,245,0.16)] text-blue-700";

  return (
    <div className={`rounded-2xl px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function SoftTable({
  headers,
  rows,
  align,
}: {
  headers: string[];
  rows: ReactNode[][];
  align?: ("left" | "center" | "right")[];
}) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white/90">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/90">
              {headers.map((h, i) => (
                <th
                  key={`${h}-${i}`}
                  className={`border-b border-slate-200 px-3 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500 ${
                    align?.[i] === "center"
                      ? "text-center"
                      : align?.[i] === "right"
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="odd:bg-white even:bg-slate-50/40">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`border-t border-slate-100 px-3 py-3 align-top text-slate-700 ${
                      align?.[ci] === "center"
                        ? "text-center"
                        : align?.[ci] === "right"
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SignatureGrid({ items }: { items: Supervisor[] }) {
  const clean = (items || [])
    .map((x) => ({
      name: String(x?.name || "").trim(),
      role: String(x?.role || "").trim(),
    }))
    .filter((x) => x.name || x.role);

  if (!clean.length) {
    return (
      <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500">
        ยังไม่มีรายชื่อผู้ควบคุมงาน
      </div>
    );
  }

  const rows = chunk(clean, 2);

  return (
    <div className="grid gap-4">
      {rows.map((row, ri) => (
        <div key={ri} className="grid gap-4 md:grid-cols-2">
          {row.map((it, i) => (
            <div
              key={`${ri}-${i}-${it.name}-${it.role}`}
              className="rounded-[22px] border border-slate-200 bg-white/90 px-5 py-6 shadow-[0_8px_24px_rgba(148,163,184,0.08)]"
            >
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Signature
              </div>
              <div className="mt-6 border-b border-dashed border-slate-300 pb-3 text-center text-sm text-slate-500">
                ลงชื่อ ................................
              </div>
              <div className="mt-3 text-center text-sm font-bold text-slate-800">
                ({it.name || "-"})
              </div>
              <div className="mt-1 text-center text-sm text-slate-500">{it.role || " "}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DefaultIssueCommentCell({ issue }: { issue: IssueRowUnified }) {
  const comments = Array.isArray(issue.comments) ? issue.comments : [];

  if (!comments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
        ยังไม่มีความเห็น
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 shadow-[0_4px_18px_rgba(148,163,184,0.08)]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(154,135,245,0.16)] px-2.5 py-1 text-[11px] font-bold text-violet-700">
              {comment.author?.role || "COMMENT"}
            </span>
            <span className="text-sm font-bold text-slate-800">{getAuthorLabel(comment.author)}</span>
            <span className="text-xs text-slate-400">{formatDateTimeThai(comment.createdAt)}</span>
          </div>

          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {comment.comment || "-"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportPreviewForm({
  model,
  renderIssueCommentCell,
}: {
  model: ReportRenderModel;
  renderIssueCommentCell?: (issue: IssueRowUnified, idx: number) => ReactNode;
}) {
  const init = useMemo(() => {
    if (typeof window === "undefined") {
      return { ss: 1, scaledW: A4_WIDTH_PX };
    }
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

  const hasOvertime = useMemo(() => {
    if (model.hasOvertime != null) return Boolean(model.hasOvertime);
    const subOt = model.subContractors?.some((r) => (Number(r.overtime) || 0) > 0);
    const eqOt = model.majorEquipment?.some((r) => (Number(r.overtime) || 0) > 0);
    return Boolean(subOt || eqOt);
  }, [model]);

  const [tempMax, setTempMax] = useState<number | null>(model.tempMaxC ?? null);
  const [tempMin, setTempMin] = useState<number | null>(model.tempMinC ?? null);
  const [wMorning, setWMorning] = useState("-");
  const [wAfternoon, setWAfternoon] = useState("-");
  const [wOvertime, setWOvertime] = useState("-");
  const [wxLoading, setWxLoading] = useState(false);

  const dateISO = useMemo(() => {
    const d = model.date || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return "";
    const y = dd.getFullYear();
    const m = pad2(dd.getMonth() + 1);
    const da = pad2(dd.getDate());
    return `${y}-${m}-${da}`;
  }, [model.date]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!dateISO) return;

      setWxLoading(true);
      try {
        const hourly = await fetchHourlyWeather(dateISO);
        const start = hmToMin("06:00");
        const end = hasOvertime ? hmToMin("24:00") : hmToMin("18:00");

        const { max, min } = calcMaxMinInRange(hourly, start, end);
        const mMorning = representativeWeather(hourly, hmToMin("08:30"), hmToMin("12:00"));
        const mAfternoon = representativeWeather(hourly, hmToMin("13:00"), hmToMin("16:30"));
        const mOver = hasOvertime
          ? representativeWeather(hourly, hmToMin("16:30"), hmToMin("24:00"))
          : "-";

        if (!cancelled) {
          setTempMax(max);
          setTempMin(min);
          setWMorning(mMorning);
          setWAfternoon(mAfternoon);
          setWOvertime(mOver);
        }
      } catch {
        if (!cancelled) {
          setTempMax(model.tempMaxC ?? null);
          setTempMin(model.tempMinC ?? null);
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
  }, [dateISO, hasOvertime, model.tempMaxC, model.tempMinC]);

  const contractorTotal = useMemo(
    () => (model.contractors || []).reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [model.contractors]
  );

  const subTotals = useMemo(() => {
    const list = model.subContractors || [];
    return {
      morning: list.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: list.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: list.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [model.subContractors]);

  const equipTotals = useMemo(() => {
    const list = model.majorEquipment || [];
    return {
      morning: list.reduce((s, r) => s + (Number(r.morning) || 0), 0),
      afternoon: list.reduce((s, r) => s + (Number(r.afternoon) || 0), 0),
      overtime: list.reduce((s, r) => s + (Number(r.overtime) || 0), 0),
    };
  }, [model.majorEquipment]);

  const maxRows = Math.max(
    model.contractors?.length || 0,
    model.subContractors?.length || 0,
    model.majorEquipment?.length || 0,
    1
  );

  const contractorsPadded = useMemo(
    () =>
      padArray(model.contractors || [], maxRows, (i) => ({
        id: `EMPTY-C-${i}`,
        name: "-",
        position: "-",
        qty: 0,
      })),
    [model.contractors, maxRows]
  );

  const subPadded = useMemo(
    () =>
      padArray(model.subContractors || [], maxRows, (i) => ({
        id: `EMPTY-S-${i}`,
        position: "-",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [model.subContractors, maxRows]
  );

  const equipPadded = useMemo(
    () =>
      padArray(model.majorEquipment || [], maxRows, (i) => ({
        id: `EMPTY-E-${i}`,
        type: "-",
        morning: 0,
        afternoon: 0,
        overtime: 0,
      })),
    [model.majorEquipment, maxRows]
  );

  const issuesList = useMemo(() => {
    const list = model.issues || [];
    return list.filter((it: any) => {
      const detail = String(it?.detail || "");
      const imageUrl = String(it?.imageUrl || "");
      const dNorm = normStr(detail);

      const isHistoryDeleted =
        dNorm.includes("รายการนี้ถูกลบ") ||
        dNorm.includes("ถูกลบ/แก้ไข") ||
        dNorm.includes("deleted/edited") ||
        dNorm.includes("deleted") ||
        Boolean(it?.isDeleted) ||
        Boolean(it?.deletedAt);

      if (isHistoryDeleted) return false;
      return detail.trim() || imageUrl.trim();
    });
  }, [model.issues]);

  const pm = model.projectMeta;
  const workRows =
    model.workPerformed?.length > 0
      ? model.workPerformed
      : [
          {
            id: "EMPTY-W",
            desc: "-",
            location: "-",
            qty: "-",
            unit: "-",
            materialDelivered: "-",
          },
        ];

  const outerHeight = Math.max(1, Math.ceil(1123 * scale));

  return (
    <div ref={wrapRef} className="w-full overflow-x-hidden">
      <div
        className="mx-auto overflow-hidden rounded-[28px] border border-white/70 bg-transparent"
        style={{ width: `${scaledWidth}px`, height: `${outerHeight}px` }}
      >
        <div
          style={{
            width: `${A4_WIDTH_PX}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(251,252,255,0.96))] p-6 shadow-[0_18px_50px_rgba(120,144,182,0.16)]">
            <div className="rounded-[26px] bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.16),rgba(247,199,217,0.16))] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Daily Report Preview
                  </div>
                  <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-slate-900">
                    รายงานประจำวัน
                  </h1>
                  <div className="mt-2 text-sm text-slate-600">
                    โครงการ {pm.projectName || model.projectName || "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">วันที่รายงาน {formatDateBE(model.date)}</div>
                </div>

                <div className="grid min-w-[230px] gap-3">
                  <MetricChip label="เลขที่รายงาน" value={pm.dailyReportNo || "-"} tone="blue" />
                  <div className="grid grid-cols-2 gap-3">
                    <MetricChip label="งวดงาน" value={pm.periodNo || "-"} tone="mint" />
                    <MetricChip label="สัปดาห์" value={pm.weekNo || "-"} tone="pink" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6">
              <section className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_10px_30px_rgba(148,163,184,0.10)]">
                <SectionTitle
                  title="ข้อมูลโครงการ"
                  subtitle="Contract information"
                  badge="Project Overview"
                />

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <MetricChip label="เลขที่สัญญา" value={pm.contractNo || "-"} />
                  <MetricChip label="บันทึกแนบท้าย" value={pm.annexNo || "-"} tone="mint" />
                  <MetricChip
                    label="เริ่มสัญญา"
                    value={formatDateBE(pm.contractStart)}
                    tone="violet"
                  />
                  <MetricChip
                    label="สิ้นสุดสัญญา"
                    value={formatDateBE(pm.contractEnd)}
                    tone="pink"
                  />
                  <MetricChip label="ผู้รับจ้าง" value={pm.contractorName || "-"} tone="mint" />
                  <MetricChip
                    label="สถานที่ก่อสร้าง"
                    value={pm.siteLocation || "-"}
                    tone="amber"
                  />
                  <MetricChip
                    label="วงเงินค่าก่อสร้าง"
                    value={pm.contractValue || "-"}
                    tone="blue"
                  />
                  <MetricChip
                    label="วิธีจัดจ้าง"
                    value={pm.procurementMethod || "-"}
                    tone="violet"
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <MetricChip
                    label="จำนวนงวด"
                    value={pm.installmentCount || 0}
                    tone="mint"
                  />
                  <MetricChip
                    label="รวมเวลาก่อสร้าง"
                    value={`${pm.totalDurationDays || 0} วัน`}
                    tone="amber"
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_10px_30px_rgba(148,163,184,0.10)]">
                <SectionTitle
                  title="ช่วงเวลาทำงานและสภาพอากาศ"
                  subtitle="Working time & weather"
                  badge="Weather"
                />

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[22px] bg-slate-50/90 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Working Time
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div>ช่วงเช้า 08:30น.-12:00น.</div>
                      <div>ช่วงบ่าย 13:00น.-17:00น.</div>
                      <div>ล่วงเวลา 17:00น. ขึ้นไป</div>
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-slate-50/90 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Weather
                    </div>

                    {wxLoading ? (
                      <div className="mt-3 text-sm text-slate-500">
                        กำลังดึงข้อมูลอุณหภูมิ/สภาพอากาศ...
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <MetricChip
                            label="อุณหภูมิสูงสุด"
                            value={`${tempMax ?? "-"}°C`}
                            tone="pink"
                          />
                          <MetricChip
                            label="อุณหภูมิต่ำสุด"
                            value={`${tempMin ?? "-"}°C`}
                            tone="blue"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <MetricChip label="เช้า" value={wMorning} tone="mint" />
                          <MetricChip label="บ่าย" value={wAfternoon} tone="violet" />
                          <MetricChip label="ล่วงเวลา" value={wOvertime} tone="amber" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_10px_30px_rgba(148,163,184,0.10)]">
                <SectionTitle
                  title="ส่วนโครงการ"
                  subtitle="Project team"
                  badge="Team Summary"
                />

                <div className="mt-4 grid gap-5">
                  <div>
                    <div className="mb-3 text-sm font-extrabold text-slate-800">
                      ผู้รับเหมา (CONTRACTORS)
                    </div>
                    <SoftTable
                      headers={["#", "รายชื่อ", "ตำแหน่ง", "จำนวน"]}
                      align={["center", "left", "left", "center"]}
                      rows={contractorsPadded.map((r, i) => [
                        i + 1,
                        r.name?.trim() ? r.name : "-",
                        r.position?.trim() ? r.position : "-",
                        Number(r.qty) || 0,
                      ])}
                    />
                    <div className="mt-3 text-right text-sm font-bold text-slate-700">
                      รวม {contractorTotal}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-extrabold text-slate-800">
                      ผู้รับเหมารายย่อย (SUB CONTRACTORS)
                    </div>
                    <SoftTable
                      headers={["#", "ตำแหน่ง", "เช้า", "บ่าย", "ล่วงเวลา"]}
                      align={["center", "left", "center", "center", "center"]}
                      rows={subPadded.map((r, i) => [
                        i + 1,
                        r.position?.trim() ? r.position : "-",
                        Number(r.morning) || 0,
                        Number(r.afternoon) || 0,
                        Number(r.overtime) || 0,
                      ])}
                    />
                    <div className="mt-3 text-right text-sm font-bold text-slate-700">
                      รวม {subTotals.morning} / {subTotals.afternoon} / {subTotals.overtime}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 text-sm font-extrabold text-slate-800">
                      เครื่องจักรหลัก (MAJOR EQUIPMENT)
                    </div>
                    <SoftTable
                      headers={["#", "ชนิด", "เช้า", "บ่าย", "ล่วงเวลา"]}
                      align={["center", "left", "center", "center", "center"]}
                      rows={equipPadded.map((r, i) => [
                        i + 1,
                        r.type?.trim() ? r.type : "-",
                        Number(r.morning) || 0,
                        Number(r.afternoon) || 0,
                        Number(r.overtime) || 0,
                      ])}
                    />
                    <div className="mt-3 text-right text-sm font-bold text-slate-700">
                      รวม {equipTotals.morning} / {equipTotals.afternoon} / {equipTotals.overtime}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_10px_30px_rgba(148,163,184,0.10)]">
                <SectionTitle
                  title="รายละเอียดงานที่ได้ดำเนินการ"
                  subtitle="Work performed"
                  badge="Execution"
                />

                <div className="mt-4">
                  <SoftTable
                    headers={["#", "รายการ", "บริเวณ", "จำนวน", "หน่วย", "วัสดุนำเข้า"]}
                    align={["center", "left", "left", "center", "center", "left"]}
                    rows={workRows.map((r, i) => [
                      i + 1,
                      r.desc || "-",
                      r.location || "-",
                      r.qty || "-",
                      r.unit || "-",
                      r.materialDelivered || "-",
                    ])}
                  />
                </div>
              </section>

              {issuesList.length > 0 && (
                <section className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_10px_30px_rgba(148,163,184,0.10)]">
                  <SectionTitle
                    title="ปัญหาและอุปสรรค"
                    subtitle="Issues / obstacles"
                    badge={`${issuesList.length} item(s)`}
                  />

                  <div className="mt-4 space-y-5">
                    {issuesList.map((it, idx) => (
                      <div
                        key={it.id || idx}
                        className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.98))] p-4 shadow-[0_8px_24px_rgba(148,163,184,0.08)]"
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-extrabold text-slate-800">
                            ปัญหาที่ {idx + 1}
                          </div>
                          <span className="rounded-full bg-[rgba(239,127,150,0.14)] px-3 py-1 text-[11px] font-bold text-rose-700">
                            ISSUE
                          </span>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50/90">
                            {it.imageUrl ? (
                              <img
                                src={it.imageUrl}
                                alt={`Issue ${idx + 1}`}
                                className="h-[220px] w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
                                ไม่มีรูปภาพ
                              </div>
                            )}
                          </div>

                          <div className="grid gap-4">
                            <div className="rounded-[22px] bg-slate-50/80 p-4">
                              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                Detail
                              </div>
                              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {it.detail || " "}
                              </div>
                            </div>

                            <div className="rounded-[22px] bg-slate-50/70 p-4">
                              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                Supervisor Comment
                              </div>
                              <div className="mt-3">
                                {renderIssueCommentCell ? (
                                  renderIssueCommentCell(it, idx)
                                ) : (
                                  <DefaultIssueCommentCell issue={it} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_10px_30px_rgba(148,163,184,0.10)]">
                <SectionTitle
                  title="บันทึกด้านความปลอดภัยในการทำงาน"
                  subtitle="Safety note"
                  badge="Safety"
                />

                <div className="mt-4 rounded-[22px] bg-slate-50/90 p-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {model.safetyNote || " "}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_10px_30px_rgba(148,163,184,0.10)]">
                <SectionTitle
                  title="รายชื่อผู้ควบคุมงาน"
                  subtitle="Supervisor signatures"
                  badge={`${model.supervisors?.length || 0} person(s)`}
                />

                <div className="mt-4">
                  <SignatureGrid items={model.supervisors || []} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ===== Readonly wrapper for Contact / Commentator / Summation ===== */
async function jgetText(url: string): Promise<any> {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();

  if (!res.ok) throw new Error(txt || `GET ${url} failed`);

  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(txt || `GET ${url} invalid json`);
  }
}

export function ReportPreviewReadonly({ reportId }: { reportId: string }) {
  const [model, setModel] = useState<ReportRenderModel | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr(null);
        setModel(null);

        const raw = await jgetText(
          `/api/daily-reports/${encodeURIComponent(reportId)}?mode=render`
        );
        const normalized = normalizeModel(raw);

        if (!cancelled) setModel(normalized);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (err) {
    return (
      <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        Preview โหลดไม่สำเร็จ: {err}
      </div>
    );
  }

  if (!model) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white/90 px-5 py-5 text-sm text-slate-500 shadow-[0_10px_30px_rgba(148,163,184,0.08)]">
        กำลังโหลด Preview...
      </div>
    );
  }

  return <ReportPreviewForm model={model} />;
}