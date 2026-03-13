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

function normalizeReport(
  detail: ApiReportDetail,
  supervisorsFromProject: Supervisor[]
): ReportRenderModel {
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
    <section className="overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(248,250,252,0.96),rgba(241,245,249,0.92))] p-5 shadow-[0_18px_50px_rgba(148,163,184,0.14)] backdrop-blur dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(30,41,59,0.96))] dark:shadow-[0_20px_60px_rgba(2,6,23,0.42)] sm:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        {badge ? (
          <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-[0_8px_24px_rgba(148,163,184,0.12)] dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-200">
            {badge}
          </div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
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
    <div className="rounded-[24px] border border-white/70 bg-white/88 p-4 shadow-[0_16px_40px_rgba(148,163,184,0.14)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-[0_18px_50px_rgba(2,6,23,0.34)]">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className={cn("mt-3 inline-flex rounded-2xl px-3 py-2 text-sm font-semibold", toneClass)}>
        {value}
      </div>
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
        const res = await fetch(
          `/api/daily-reports?projectId=${encodeURIComponent(projectId)}`,
          { cache: "no-store" }
        );
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

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "โหลดรายงานไม่สำเร็จ");
        }

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

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "โหลด supervisors ไม่สำเร็จ");
        }

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
        const res = await fetch(
          `/api/daily-reports/${encodeURIComponent(reportId)}/approvals`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "โหลด approvals ไม่สำเร็จ");
        }

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

  function renderSummationIssueCommentCell(issue: IssueRowUnified) {
    const comments = Array.isArray(issue?.comments) ? issue.comments : [];

    if (!comments.length) {
      return <div className="text-sm text-slate-500 dark:text-slate-400">ยังไม่มีความคิดเห็น</div>;
    }

    return (
      <div className="space-y-3">
        {comments.map((comment) => {
          const authorName =
            comment.author?.name?.trim() ||
            comment.author?.email?.trim() ||
            "ผู้แสดงความคิดเห็น";

          const authorRole = comment.author?.role?.trim() || "";

          return (
            <div
              key={comment.id}
              className="rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70"
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {comment.comment || "-"}
              </div>

              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {authorName}
                {authorRole ? ` (${authorRole})` : ""} •{" "}
                {formatDateTimeThai(comment.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

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
      const res = await fetch(
        `/api/daily-reports/${encodeURIComponent(reportId)}/approvals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "ยืนยันไม่สำเร็จ");
      }

      const res2 = await fetch(
        `/api/daily-reports/${encodeURIComponent(reportId)}/approvals`,
        { cache: "no-store" }
      );
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
    <div className="min-h-[calc(100dvh-4rem)] w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 px-3 py-3 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,rgba(240,244,255,0.96),rgba(236,249,245,0.9),rgba(255,244,246,0.92))] p-5 shadow-[0_14px_38px_rgba(148,163,184,0.10)] backdrop-blur dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(30,41,59,0.96))] dark:shadow-[0_20px_60px_rgba(2,6,23,0.45)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                information Approve
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                ตรวจสอบรายงานประจำวัน
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                ตรวจสอบและอนุมัติรายงานประจำวันที่ส่งโดยผู้ควบคุมงาน
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {reportId ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/80 bg-white/88 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200">
                  Report: {reportId}
                </div>
              ) : null}

              <div
                className={cn(
                  "inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/80 px-4 py-2 text-sm font-semibold shadow-sm dark:border-slate-700/80",
                  allApproved
                    ? "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300"
                    : "bg-[rgba(243,190,114,0.18)] text-amber-700 dark:text-amber-300"
                )}
              >
                {allApproved ? "อนุมัติครบแล้ว" : "รออนุมัติ"}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="ผู้ควบคุมงานทั้งหมด"
            value={loadingSup ? "กำลังโหลด..." : supervisors.length}
            tone="blue"
          />
          <StatCard
            label="อนุมัติแล้ว"
            value={loadingApprovals ? "กำลังโหลด..." : approvedSupervisorCount}
            tone="mint"
          />
          <StatCard
            label="รออนุมัติ"
            value={loadingApprovals ? "กำลังโหลด..." : pendingSupervisorCount}
            tone="amber"
          />
          <StatCard
            label="จำนวนปัญหา"
            value={loadingDetail ? "กำลังโหลด..." : issueCount}
            tone="violet"
          />
        </div>

        <SectionCard
          title="เลือกข้อมูลรายงาน"
          subtitle="เลือกโครงการและรายงานประจำวันที่ต้องการตรวจสอบและอนุมัติ"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <FieldLabel>โครงการ</FieldLabel>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loadingProjects || projects.length === 0}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-700 dark:focus:ring-slate-800"
              >
                {loadingProjects ? (
                  <option>กำลังโหลดโครงการ...</option>
                ) : projects.length === 0 ? (
                  <option>ไม่พบโครงการ</option>
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
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                disabled={!projectId || loadingReports || reports.length === 0}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-700 dark:focus:ring-slate-800"
              >
                {!projectId ? (
                  <option>เลือกโครงการก่อน</option>
                ) : loadingReports ? (
                  <option>กำลังโหลดรายงาน...</option>
                ) : reports.length === 0 ? (
                  <option>ไม่พบรายงาน</option>
                ) : (
                  reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {formatDateBE(r.date)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={onApproveMe}
                disabled={
                  saving ||
                  !reportId ||
                  loadingDetail ||
                  loadingSup ||
                  loadingApprovals ||
                  disableApproveBecauseComments
                }
                className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 px-5 text-sm font-semibold text-slate-700 shadow-[0_10px_30px_rgba(148,163,184,0.14)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100 dark:shadow-[0_12px_30px_rgba(2,6,23,0.35)] dark:hover:bg-slate-900"
              >
                {saving ? "กำลังยืนยัน..." : "ยืนยันของฉัน"}
              </button>
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
              {err}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="สถานะผู้ควบคุมงาน"
          subtitle="แสดงสถานะการอนุมัติของผู้ควบคุมงานในโครงการ"
        >
          {loadingApprovals ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
              กำลังโหลดสถานะการอนุมัติ...
            </div>
          ) : supervisors.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
              ยังไม่มีรายชื่อผู้ควบคุมงานในโครงการ
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {supervisors.map((s, idx) => {
                const approved = approvalsMap.get(norm(s.name));

                return (
                  <div
                    key={`${s.name}-${idx}`}
                    className="rounded-[24px] border border-white/70 bg-white/88 p-4 shadow-[0_16px_40px_rgba(148,163,184,0.14)] dark:border-slate-800/80 dark:bg-slate-900/75 dark:shadow-[0_18px_50px_rgba(2,6,23,0.32)]"
                  >
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {s.name || "-"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {s.role || "-"}
                    </div>

                    {approved ? (
                      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        อนุมัติเมื่อ {formatDateTimeThai(approved.approvedAt)}
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        "mt-4 inline-flex rounded-2xl px-3 py-2 text-sm font-semibold",
                        approvalTone(Boolean(approved))
                      )}
                    >
                      {approved ? "Approved" : "Pending"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {!reportId ? (
          <div className="rounded-[26px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
            กรุณาเลือกโครงการและรายงานก่อน
          </div>
        ) : loadingDetail || loadingSup || !model ? (
          <div className="rounded-[26px] border border-slate-200 bg-white/85 px-5 py-4 text-sm text-slate-500 shadow-[0_18px_50px_rgba(148,163,184,0.1)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300 dark:shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
            กำลังโหลด Preview...
          </div>
        ) : (
          <section className="rounded-[28px] border border-slate-200/70 bg-slate-100/70 p-2 shadow-[0_18px_50px_rgba(148,163,184,0.08)] dark:border-slate-800/80 dark:bg-slate-900/60 dark:shadow-[0_20px_60px_rgba(2,6,23,0.32)] sm:p-3">
            <ReportPreviewForm
              model={model}
              renderIssueCommentCell={(issue) => renderSummationIssueCommentCell(issue)}
            />
          </section>
        )}
      </div>
    </div>
  );
}