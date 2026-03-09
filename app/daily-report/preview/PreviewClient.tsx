"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ContractorRow = {
  id: string;
  name: string;
  position: string;
  qty: number;
};

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

type IssueComment = {
  id: string;
  comment: string;
  createdAt: string;
  author?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

type IssueRow = {
  id: string;
  detail: string;
  imageUrl: string;
  comments: IssueComment[];
};

type Supervisor = {
  name: string;
  role: string;
};

type ProjectMeta = {
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

type ReportModel = {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  projectMeta: ProjectMeta;
  tempMaxC: number | null;
  tempMinC: number | null;
  contractors: ContractorRow[];
  subContractors: SubContractorRow[];
  majorEquipment: MajorEquipmentRow[];
  workPerformed: WorkRow[];
  issues: IssueRow[];
  safetyNote: string;
  supervisors: Supervisor[];
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateBE(iso?: string) {
  if (!iso) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${pad2(d)}/${pad2(m)}/${y + 543}`;
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear() + 543}`;
}

function valueText(v: unknown) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function normalizeReport(raw: any): ReportModel {
  const src = raw?.report ?? raw ?? {};
  const pmRaw = src?.projectMeta ?? src?.project_meta ?? src?.meta ?? {};

  return {
    id: String(src?.id ?? ""),
    date: String(src?.date ?? ""),
    projectId: String(src?.projectId ?? ""),
    projectName: String(src?.projectName ?? pmRaw?.projectName ?? "-"),
    projectMeta: {
      projectName: String(pmRaw?.projectName ?? src?.projectName ?? "-"),
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
    },
    tempMaxC:
      typeof src?.tempMaxC === "number"
        ? src.tempMaxC
        : typeof src?.temp_max_c === "number"
        ? src.temp_max_c
        : null,
    tempMinC:
      typeof src?.tempMinC === "number"
        ? src.tempMinC
        : typeof src?.temp_min_c === "number"
        ? src.temp_min_c
        : null,
    contractors: safeArray<any>(src?.contractors).map((x, i) => ({
      id: String(x?.id ?? `c-${i}`),
      name: String(x?.name ?? ""),
      position: String(x?.position ?? ""),
      qty: Number(x?.qty ?? 0),
    })),
    subContractors: safeArray<any>(src?.subContractors ?? src?.sub_contractors).map((x, i) => ({
      id: String(x?.id ?? `s-${i}`),
      position: String(x?.position ?? ""),
      morning: Number(x?.morning ?? 0),
      afternoon: Number(x?.afternoon ?? 0),
      overtime: Number(x?.overtime ?? 0),
    })),
    majorEquipment: safeArray<any>(src?.majorEquipment ?? src?.major_equipment).map((x, i) => ({
      id: String(x?.id ?? `e-${i}`),
      type: String(x?.type ?? ""),
      morning: Number(x?.morning ?? 0),
      afternoon: Number(x?.afternoon ?? 0),
      overtime: Number(x?.overtime ?? 0),
    })),
    workPerformed: safeArray<any>(src?.workPerformed ?? src?.work_performed).map((x, i) => ({
      id: String(x?.id ?? `w-${i}`),
      desc: String(x?.desc ?? ""),
      location: String(x?.location ?? ""),
      qty: String(x?.qty ?? ""),
      unit: String(x?.unit ?? ""),
      materialDelivered: String(x?.materialDelivered ?? x?.material ?? ""),
    })),
    issues: safeArray<any>(src?.issues).map((x, i) => ({
      id: String(x?.id ?? `i-${i}`),
      detail: String(x?.detail ?? ""),
      imageUrl: String(x?.imageUrl ?? x?.image_url ?? ""),
      comments: safeArray<any>(x?.comments).map((c, ci) => ({
        id: String(c?.id ?? `ic-${i}-${ci}`),
        comment: String(c?.comment ?? ""),
        createdAt: String(c?.createdAt ?? ""),
        author: c?.author
          ? {
              name: c.author?.name ?? null,
              email: c.author?.email ?? null,
              role: c.author?.role ?? null,
            }
          : null,
      })),
    })),
    safetyNote: String(src?.safetyNote ?? src?.safety_note ?? ""),
    supervisors: safeArray<any>(src?.supervisors).map((x) => ({
      name: String(x?.name ?? ""),
      role: String(x?.role ?? ""),
    })),
  };
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
    <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.16)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/75">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </div>
      <div className={cn("mt-3 inline-flex rounded-2xl px-3 py-2 text-sm font-semibold", toneClass)}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/75 bg-white/88 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.16)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/75">
      <div className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </div>
      {children}
    </section>
  );
}

function GridField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

function ReadonlyTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-100/80 dark:bg-slate-900/70">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, i) => (
              <tr key={i} className="bg-white/70 dark:bg-slate-950/20">
                {row.map((cell, j) => (
                  <td
                    key={`${i}-${j}`}
                    className="border-b border-slate-100 px-3 py-2 align-top text-slate-700 dark:border-slate-900 dark:text-slate-200"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className="px-3 py-4 text-center text-slate-400"
              >
                ไม่มีข้อมูล
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function PreviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reportId, setReportId] = useState("");
  const [model, setModel] = useState<ReportModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const queryReportId = searchParams.get("reportId") || "";

  useEffect(() => {
    const fromQuery = queryReportId.trim();
    if (fromQuery) {
      setReportId(fromQuery);
      return;
    }

    try {
      const fromSession = sessionStorage.getItem("lastSubmittedReportId") || "";
      setReportId(fromSession);
    } catch {
      setReportId("");
    }
  }, [queryReportId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!reportId) return;

      setLoading(true);
      setErr("");
      setModel(null);

      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "โหลดข้อมูล preview ไม่สำเร็จ");
        }

        const normalized = normalizeReport(json);
        if (!cancelled) {
          setModel(normalized);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(String(e?.message || e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const contractorTotal = useMemo(
    () => (model?.contractors || []).reduce((sum, row) => sum + (Number(row.qty) || 0), 0),
    [model]
  );

  const subTotals = useMemo(() => {
    const rows = model?.subContractors || [];
    return {
      morning: rows.reduce((sum, row) => sum + (Number(row.morning) || 0), 0),
      afternoon: rows.reduce((sum, row) => sum + (Number(row.afternoon) || 0), 0),
      overtime: rows.reduce((sum, row) => sum + (Number(row.overtime) || 0), 0),
    };
  }, [model]);

  const equipmentTotals = useMemo(() => {
    const rows = model?.majorEquipment || [];
    return {
      morning: rows.reduce((sum, row) => sum + (Number(row.morning) || 0), 0),
      afternoon: rows.reduce((sum, row) => sum + (Number(row.afternoon) || 0), 0),
      overtime: rows.reduce((sum, row) => sum + (Number(row.overtime) || 0), 0),
    };
  }, [model]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 md:px-6">
      <div className="rounded-[32px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_rgba(148,163,184,0.18)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/75">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Preview
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Daily report preview
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              ตรวจสอบข้อมูลรายงานก่อนส่งต่อไปยังการแสดงความคิดเห็นหรือการอนุมัติ
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/daily-report")}
              className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/80 bg-white/88 px-4 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/60 dark:text-slate-200"
            >
              กลับไปแก้ไข
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
            >
              พิมพ์ / Save PDF
            </button>
          </div>
        </div>
      </div>

      {!reportId ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
          ไม่พบ reportId สำหรับเปิด Preview
        </div>
      ) : loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          กำลังเตรียมข้อมูล Preview...
        </div>
      ) : err ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
          {err}
        </div>
      ) : !model ? null : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="วันที่รายงาน" value={formatDateBE(model.date)} tone="violet" />
            <StatCard label="โครงการ" value={valueText(model.projectName)} tone="blue" />
            <StatCard
              label="เลขที่รายงาน"
              value={valueText(model.projectMeta.dailyReportNo)}
              tone="mint"
            />
            <StatCard
              label="งวด / สัปดาห์"
              value={`${valueText(model.projectMeta.periodNo)} • ${valueText(model.projectMeta.weekNo)}`}
              tone="amber"
            />
          </div>

          <Section title="ข้อมูลโครงการ">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <GridField label="สัญญาจ้าง" value={valueText(model.projectMeta.contractNo)} />
              <GridField label="บันทึกแนบท้ายที่" value={valueText(model.projectMeta.annexNo)} />
              <GridField label="สถานที่ก่อสร้าง" value={valueText(model.projectMeta.siteLocation)} />
              <GridField label="เริ่มสัญญา" value={formatDateBE(model.projectMeta.contractStart)} />
              <GridField label="สิ้นสุดสัญญา" value={formatDateBE(model.projectMeta.contractEnd)} />
              <GridField label="ผู้รับจ้าง" value={valueText(model.projectMeta.contractorName)} />
              <GridField label="วงเงินค่าก่อสร้าง" value={valueText(model.projectMeta.contractValue)} />
              <GridField label="จัดจ้างโดยวิธี" value={valueText(model.projectMeta.procurementMethod)} />
              <GridField
                label="รวมเวลาก่อสร้าง"
                value={
                  model.projectMeta.totalDurationDays
                    ? `${model.projectMeta.totalDurationDays} วัน`
                    : "-"
                }
              />
            </div>
          </Section>

          <Section title="ช่วงเวลาทำงาน / สภาพอากาศ">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <GridField label="ช่วงเช้า" value="08:30น. - 12:00น." />
              <GridField label="ช่วงบ่าย" value="13:00น. - 17:00น." />
              <GridField label="ล่วงเวลา" value="17:00น. ขึ้นไป" />
              <GridField
                label="อุณหภูมิ"
                value={`สูงสุด ${valueText(model.tempMaxC)}°C / ต่ำสุด ${valueText(model.tempMinC)}°C`}
              />
            </div>
          </Section>

          <Section title="ส่วนโครงการ (Project Team)">
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  ผู้รับเหมา (Contractors)
                </div>
                <ReadonlyTable
                  headers={["#", "รายชื่อ", "ตำแหน่ง", "จำนวน"]}
                  rows={[
                    ...(model.contractors.length
                      ? model.contractors.map((row, index) => [
                          index + 1,
                          valueText(row.name),
                          valueText(row.position),
                          Number(row.qty) || 0,
                        ])
                      : [[1, "-", "-", 0]]),
                    ["", "รวม", "", contractorTotal],
                  ]}
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  ผู้รับเหมารายย่อย (Sub Contractors)
                </div>
                <ReadonlyTable
                  headers={["#", "ตำแหน่ง", "เช้า", "บ่าย", "ล่วงเวลา"]}
                  rows={[
                    ...(model.subContractors.length
                      ? model.subContractors.map((row, index) => [
                          index + 1,
                          valueText(row.position),
                          Number(row.morning) || 0,
                          Number(row.afternoon) || 0,
                          Number(row.overtime) || 0,
                        ])
                      : [[1, "-", 0, 0, 0]]),
                    ["", "รวม", subTotals.morning, subTotals.afternoon, subTotals.overtime],
                  ]}
                />
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  เครื่องจักรหลัก (Major Equipment)
                </div>
                <ReadonlyTable
                  headers={["#", "ชนิด", "เช้า", "บ่าย", "ล่วงเวลา"]}
                  rows={[
                    ...(model.majorEquipment.length
                      ? model.majorEquipment.map((row, index) => [
                          index + 1,
                          valueText(row.type),
                          Number(row.morning) || 0,
                          Number(row.afternoon) || 0,
                          Number(row.overtime) || 0,
                        ])
                      : [[1, "-", 0, 0, 0]]),
                    [
                      "",
                      "รวม",
                      equipmentTotals.morning,
                      equipmentTotals.afternoon,
                      equipmentTotals.overtime,
                    ],
                  ]}
                />
              </div>
            </div>
          </Section>

          <Section title="รายละเอียดของงานที่ได้ดำเนินงานทำแล้ว (Work Performed)">
            <ReadonlyTable
              headers={["#", "รายการ", "บริเวณ", "จำนวน", "หน่วย", "วัสดุนำเข้า"]}
              rows={
                model.workPerformed.length
                  ? model.workPerformed.map((row, index) => [
                      index + 1,
                      valueText(row.desc),
                      valueText(row.location),
                      valueText(row.qty),
                      valueText(row.unit),
                      valueText(row.materialDelivered),
                    ])
                  : [[1, "-", "-", "-", "-", "-"]]
              }
            />
          </Section>

          <Section title="บันทึกด้านความปลอดภัยในการทำงาน">
            <div className="min-h-24 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200">
              {model.safetyNote?.trim() ? model.safetyNote : "-"}
            </div>
          </Section>

          <Section title="ปัญหาและอุปสรรค">
            <div className="space-y-4">
              {model.issues.length ? (
                model.issues.map((issue, index) => (
                  <div
                    key={issue.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/30"
                  >
                    <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      รายการที่ {index + 1}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                      <div className="space-y-3">
                        <GridField label="รายละเอียด" value={valueText(issue.detail)} />
                        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                            ความคิดเห็น
                          </div>
                          {issue.comments.length ? (
                            <div className="space-y-3">
                              {issue.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40"
                                >
                                  <div className="text-sm text-slate-700 dark:text-slate-200">
                                    {comment.comment || "-"}
                                  </div>
                                  <div className="mt-2 text-xs text-slate-400">
                                    {comment.author?.name || comment.author?.email || "ผู้แสดงความคิดเห็น"}{" "}
                                    • {formatDateBE(comment.createdAt)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400">ยังไม่มีความคิดเห็น</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                          รูปภาพ
                        </div>
                        {issue.imageUrl ? (
                          <img
                            src={issue.imageUrl}
                            alt={`issue-${index + 1}`}
                            className="h-auto w-full rounded-xl border border-slate-200 object-cover dark:border-slate-800"
                          />
                        ) : (
                          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 dark:border-slate-700">
                            ไม่มีรูปภาพ
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400 dark:border-slate-700">
                  ไม่มีปัญหาและอุปสรรค
                </div>
              )}
            </div>
          </Section>

          <Section title="รายชื่อผู้ควบคุมงาน">
            {model.supervisors.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {model.supervisors.map((s, index) => (
                  <div
                    key={`${s.name}-${index}`}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {s.name || "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{s.role || "-"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">-</div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}