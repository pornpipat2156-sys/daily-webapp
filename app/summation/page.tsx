"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReportPreviewForm,
  type ContractorRow,
  type IssueComment,
  type IssueRowUnified,
  type MajorEquipmentRow,
  type ProjectMetaUnified,
  type ReportRenderModel,
  type SubContractorRow,
  type Supervisor,
  type WorkRow,
  formatDateBE,
} from "@/components/ReportPreviewReadonly";

type ProjectRow = {
  id: string;
  projectName: string;
};

type ReportRow = {
  id: string;
  date: string;
};

type Author = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type ApiIssueComment = {
  id: string;
  comment: string;
  createdAt: string;
  author: Author;
};

type ApiIssue = {
  id: string;
  detail: string;
  imageUrl: string | null;
  createdAt: string;
  comments: ApiIssueComment[];
};

type ApprovalRow = {
  id: string;
  approverName: string;
  approverRole: string | null;
  approverUserId: string | null;
  approvedAt: string;
};

type ApiProjectMeta = {
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

type ApiReportDetail = {
  id: string;
  projectId: string;
  date: string;
  projectName: string;
  projectMeta: ApiProjectMeta | null;
  issues: ApiIssue[];
  contractors?: ContractorRow[];
  subContractors?: SubContractorRow[];
  majorEquipment?: MajorEquipmentRow[];
  workPerformed?: WorkRow[];
  safetyNote?: string;
  tempMaxC?: number | null;
  tempMinC?: number | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normStr(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function norm(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isHistoryDeletedIssue(it: ApiIssue) {
  const d = normStr(it?.detail);
  return (
    d.includes("รายการนี้ถูกลบ") ||
    d.includes("ถูกลบ/แก้ไข") ||
    d.includes("deleted/edited") ||
    d.includes("deleted")
  );
}

function toSupervisorArray(input: any): Supervisor[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((it) => ({
      name: String(it?.name ?? "").trim(),
      role: String(it?.role ?? "").trim(),
    }))
    .filter((it) => it.name || it.role);
}

function normalizeProjectMeta(
  projectName: string,
  meta?: ApiProjectMeta | null
): ProjectMetaUnified {
  return {
    projectName: String(projectName || "-"),
    contractNo: String(meta?.contractNo ?? "-"),
    annexNo: String(meta?.annexNo ?? "-"),
    contractStart: String(meta?.contractStart ?? "-"),
    contractEnd: String(meta?.contractEnd ?? "-"),
    contractorName: String(meta?.contractorName ?? "-"),
    siteLocation: String(meta?.siteLocation ?? "-"),
    contractValue: String(meta?.contractValue ?? "-"),
    procurementMethod: String(meta?.procurementMethod ?? "-"),
    installmentCount: Number(meta?.installmentCount ?? 0),
    totalDurationDays: Number(meta?.totalDurationDays ?? 0),
    dailyReportNo: String(meta?.dailyReportNo ?? "-"),
    periodNo: String(meta?.periodNo ?? "-"),
    weekNo: String(meta?.weekNo ?? "-"),
  };
}

function normalizeIssueComments(list: ApiIssueComment[] | undefined): IssueComment[] {
  if (!Array.isArray(list)) return [];
  return list.map((c) => ({
    id: String(c?.id ?? ""),
    comment: String(c?.comment ?? ""),
    createdAt: String(c?.createdAt ?? ""),
    author: c?.author
      ? {
          name: c.author?.name ?? null,
          email: c.author?.email ?? null,
          role: c.author?.role ?? null,
        }
      : null,
  }));
}

function normalizeReport(detail: ApiReportDetail, supervisorsFromProject: Supervisor[]): ReportRenderModel {
  const issues: IssueRowUnified[] = Array.isArray(detail?.issues)
    ? detail.issues.map((it) => ({
        id: String(it?.id ?? ""),
        detail: String(it?.detail ?? ""),
        imageUrl: String(it?.imageUrl ?? ""),
        comments: normalizeIssueComments(it?.comments),
      }))
    : [];

  return {
    date: String(detail?.date ?? ""),
    projectName: String(detail?.projectName ?? "-"),
    projectMeta: normalizeProjectMeta(detail?.projectName ?? "-", detail?.projectMeta),
    contractors: Array.isArray(detail?.contractors) ? detail.contractors : [],
    subContractors: Array.isArray(detail?.subContractors) ? detail.subContractors : [],
    majorEquipment: Array.isArray(detail?.majorEquipment) ? detail.majorEquipment : [],
    workPerformed: Array.isArray(detail?.workPerformed) ? detail.workPerformed : [],
    issues,
    safetyNote: String(detail?.safetyNote ?? ""),
    tempMaxC: detail?.tempMaxC ?? null,
    tempMinC: detail?.tempMinC ?? null,
    supervisors: supervisorsFromProject,
  };
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

function SectionCard({
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
      <div className="mt-1 text-sm font-bold break-words">{value}</div>
    </div>
  );
}

function approvalTone(approved: boolean) {
  return approved
    ? "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300"
    : "bg-[rgba(243,190,114,0.18)] text-amber-700 dark:text-amber-300";
}

export default function SummationPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportId, setReportId] = useState("");

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingSup, setLoadingSup] = useState(false);
  const [loadingApprovals, setLoadingApprovals] = useState(false);

  const [detail, setDetail] = useState<ApiReportDetail | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;

    async function run() {
      setLoadingProjects(true);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        const list: ProjectRow[] = Array.isArray(json)
          ? json.map((p: any) => ({
              id: String(p?.id ?? ""),
              projectName: String(p?.projectName ?? "-"),
            }))
          : [];

        if (!cancel) {
          setProjects(list);
          if (list.length > 0) {
            setProjectId((prev) => prev || list[0].id);
          }
        }
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

  useEffect(() => {
    let cancel = false;

    async function run() {
      setErr("");
      setReports([]);
      setReportId("");
      setDetail(null);
      setApprovals([]);

      if (!projectId) return;

      setLoadingReports(true);
      try {
        const res = await fetch(`/api/daily-reports?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        const list: ReportRow[] = Array.isArray(json?.reports)
          ? json.reports.map((r: any) => ({
              id: String(r?.id ?? ""),
              date: String(r?.date ?? ""),
            }))
          : [];

        if (!cancel) {
          setReports(list);
          setReportId(list[0]?.id ?? "");
        }
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

  useEffect(() => {
    let cancel = false;

    async function run() {
      setErr("");
      setDetail(null);
      if (!reportId) return;

      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลดรายงานไม่สำเร็จ");

        if (!cancel) setDetail(json.report as ApiReportDetail);
      } catch (e: any) {
        if (!cancel) setErr(String(e?.message || e));
      } finally {
        if (!cancel) setLoadingDetail(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  useEffect(() => {
    let cancel = false;

    async function run() {
      setErr("");
      setSupervisors([]);
      if (!projectId) return;

      setLoadingSup(true);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลด supervisors ไม่สำเร็จ");

        const fromProject =
          json?.project?.meta?.supervisors ??
          json?.project?.projectMeta?.supervisors ??
          json?.project?.supervisors ??
          [];

        if (!cancel) {
          setSupervisors(toSupervisorArray(fromProject));
        }
      } catch (e: any) {
        if (!cancel) {
          setSupervisors([]);
          setErr(String(e?.message || e));
        }
      } finally {
        if (!cancel) setLoadingSup(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancel = false;

    async function run() {
      setErr("");
      setApprovals([]);
      if (!reportId) return;

      setLoadingApprovals(true);
      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลด approvals ไม่สำเร็จ");

        const list: ApprovalRow[] = Array.isArray(json?.approvals) ? json.approvals : [];
        if (!cancel) setApprovals(list);
      } catch (e: any) {
        if (!cancel) setErr(String(e?.message || e));
      } finally {
        if (!cancel) setLoadingApprovals(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  const model = useMemo(() => {
    if (!detail) return null;
    return normalizeReport(detail, supervisors);
  }, [detail, supervisors]);

  const visibleIssues = useMemo(() => {
    const list = detail?.issues || [];
    return list.filter((it) => {
      if (isHistoryDeletedIssue(it)) return false;
      const d = String(it?.detail || "").trim();
      const img = String(it?.imageUrl || "").trim();
      return Boolean(d || img);
    });
  }, [detail?.issues]);

  const issueCount = useMemo(() => visibleIssues.length, [visibleIssues]);

  const allIssuesHaveAtLeastOneComment = useMemo(() => {
    if (!visibleIssues.length) return true;
    return visibleIssues.every((it) => (it.comments || []).length > 0);
  }, [visibleIssues]);

  const disableApproveBecauseComments = issueCount > 0 && !allIssuesHaveAtLeastOneComment;

  const approvalsMap = useMemo(() => {
    const m = new Map<string, ApprovalRow>();
    for (const a of approvals) m.set(norm(a.approverName), a);
    return m;
  }, [approvals]);

  const allApproved = useMemo(() => {
    if (!supervisors.length) return false;
    if (!reportId) return false;
    return supervisors.every((s) => approvalsMap.has(norm(s.name)));
  }, [supervisors, approvalsMap, reportId]);

  const pendingSupervisorCount = useMemo(() => {
    if (!supervisors.length) return 0;
    return supervisors.filter((s) => !approvalsMap.has(norm(s.name))).length;
  }, [supervisors, approvalsMap]);

  const approvedSupervisorCount = useMemo(() => {
    if (!supervisors.length) return 0;
    return supervisors.filter((s) => approvalsMap.has(norm(s.name))).length;
  }, [supervisors, approvalsMap]);

  async function onApproveMe() {
    setErr("");

    if (!reportId) {
      setErr("กรุณาเลือกรายงานก่อน");
      return;
    }

    if (disableApproveBecauseComments) {
      setErr("ยังแสดงความคิดเห็นไม่ครบทุกปัญหา กรุณาไปแท็บ “แสดงความคิดเห็น” ก่อน");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message || "ยืนยันไม่สำเร็จ");

      const res2 = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, {
        cache: "no-store",
      });
      const json2 = await res2.json().catch(() => null);
      if (res2.ok && json2?.ok && Array.isArray(json2.approvals)) {
        setApprovals(json2.approvals);
      }

      alert("ยืนยันสำเร็จ ✅");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-8 sm:px-4 lg:px-6">
      <div className="mb-5 rounded-[30px] bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.14),rgba(247,199,217,0.16))] p-5 shadow-[0_14px_38px_rgba(148,163,184,0.10)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Summation
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Review & approval
            </h1>
            <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              เลือกโครงการ → เลือกรายงาน → ตรวจสอบข้อมูลแบบอ่านอย่างเดียว → ผู้ควบคุมงานกดยืนยันของตนเอง
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {reportId ? (
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900/60 dark:text-slate-200">
                Report: {reportId}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold shadow-sm",
                allApproved
                  ? "bg-[rgba(121,217,199,0.18)] text-emerald-700 dark:text-emerald-300"
                  : "bg-[rgba(243,190,114,0.18)] text-amber-700 dark:text-amber-300"
              )}
            >
              {allApproved ? "อนุมัติครบแล้ว" : "รออนุมัติ"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionCard
            title="เลือกข้อมูล"
            subtitle="เลือกโครงการและรายงานที่ต้องการตรวจสอบ"
            badge="Selector"
          >
            <div className="space-y-4">
              <div>
                <FieldLabel>โครงการ</FieldLabel>
                <select
                  className="soft-input h-12 w-full px-4 text-sm text-slate-700 hover:bg-white disabled:opacity-50 dark:text-slate-100"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={loadingProjects || projects.length === 0}
                >
                  {loadingProjects ? (
                    <option value="">กำลังโหลดโครงการ...</option>
                  ) : projects.length === 0 ? (
                    <option value="">ไม่พบโครงการ</option>
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
                <FieldLabel>รายงานประจำวันที่</FieldLabel>
                <select
                  className="soft-input h-12 w-full px-4 text-sm text-slate-700 hover:bg-white disabled:opacity-50 dark:text-slate-100"
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  disabled={!projectId || loadingReports || reports.length === 0}
                >
                  {!projectId ? (
                    <option value="">เลือกโครงการก่อน</option>
                  ) : loadingReports ? (
                    <option value="">กำลังโหลดรายงาน...</option>
                  ) : reports.length === 0 ? (
                    <option value="">ไม่พบรายงาน</option>
                  ) : (
                    reports.map((r) => (
                      <option key={r.id} value={r.id}>
                        {formatDateBE(r.date)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard label="จำนวนรายงาน" value={reports.length} tone="blue" />
              <StatCard label="Supervisors" value={supervisors.length} tone="mint" />
            </div>
          </SectionCard>

          <SectionCard
            title="สถานะการอนุมัติ"
            subtitle="ตรวจสอบรายชื่อผู้ควบคุมงานที่อนุมัติแล้วและที่ยังรออยู่"
            badge="Approvals"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="อนุมัติแล้ว" value={approvedSupervisorCount} tone="mint" />
              <StatCard label="รออนุมัติ" value={pendingSupervisorCount} tone="amber" />
              <StatCard label="Issue ที่ต้องเช็ก" value={issueCount} tone="pink" />
              <StatCard
                label="คอมเมนต์ครบทุก Issue"
                value={allIssuesHaveAtLeastOneComment ? "ครบแล้ว" : "ยังไม่ครบ"}
                tone={allIssuesHaveAtLeastOneComment ? "violet" : "amber"}
              />
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={onApproveMe}
                disabled={!reportId || saving || disableApproveBecauseComments}
                title={
                  disableApproveBecauseComments
                    ? "ต้องแสดงความคิดเห็นให้ครบก่อน"
                    : "ผู้ควบคุมงานแต่ละคนต้อง login มากดยืนยันของตัวเอง"
                }
                className="soft-btn inline-flex min-h-12 w-full items-center justify-center rounded-[20px] border border-primary/25 bg-[linear-gradient(135deg,rgba(124,156,245,0.96),rgba(121,217,199,0.96))] px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(124,156,245,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "กำลังยืนยัน..." : "ยืนยันของฉัน"}
              </button>
            </div>

            {err ? (
              <div className="mt-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {err}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {loadingApprovals ? (
                <div className="rounded-[20px] border border-dashed border-border bg-white/70 px-4 py-4 text-sm text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
                  กำลังโหลดสถานะการอนุมัติ...
                </div>
              ) : supervisors.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-border bg-white/70 px-4 py-4 text-sm text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
                  ยังไม่มีรายชื่อผู้ควบคุมงานในโครงการ
                </div>
              ) : (
                supervisors.map((s, idx) => {
                  const approved = approvalsMap.get(norm(s.name));
                  return (
                    <div
                      key={`${s.name}-${s.role}-${idx}`}
                      className="rounded-[22px] border border-border/80 bg-white/85 p-4 shadow-[0_6px_18px_rgba(148,163,184,0.08)] dark:bg-slate-900/50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {s.name || "-"}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {s.role || "-"}
                          </div>
                          {approved ? (
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              อนุมัติเมื่อ {formatDateTimeThai(approved.approvedAt)}
                            </div>
                          ) : null}
                        </div>

                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-bold",
                            approvalTone(Boolean(approved))
                          )}
                        >
                          {approved ? "Approved" : "Pending"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Preview รายงาน"
          subtitle="ตรวจสอบรายงานแบบอ่านอย่างเดียวก่อนกดยืนยัน"
          badge="Preview"
        >
          {!reportId ? (
            <div className="rounded-[24px] border border-dashed border-border bg-white/70 px-5 py-10 text-center text-sm text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
              กรุณาเลือกโครงการและรายงานก่อน
            </div>
          ) : loadingDetail || loadingSup || !model ? (
            <div className="rounded-[24px] border border-dashed border-border bg-white/70 px-5 py-10 text-center text-sm text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
              กำลังโหลด Preview...
            </div>
          ) : (
            <ReportPreviewForm model={model} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}