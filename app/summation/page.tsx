// app/summation/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReportPreviewReadonly } from "@/components/ReportPreviewReadonly";

type ProjectRow = { id: string; projectName: string };
type ReportRow = { id: string; date: string };

type Supervisor = { name: string; role: string };

type ApprovalRow = {
  id: string;
  approverName: string;
  approverRole: string | null;
  approverUserId: string | null;
  approvedAt: string; // ISO string
};

type IssueCommentRow = {
  id: string;
  comment: string;
  createdAt: string; // ISO
  author?: { name?: string | null; email?: string | null } | null;
};

type IssueRow = {
  id: string;
  title?: string | null;
  detail?: string | null;
  comments?: IssueCommentRow[];
};

type ReportDetail = {
  ok?: boolean;
  report?: { id: string; date?: string | null } | null;
  issues?: IssueRow[];
};

function formatDateBE(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

function norm(s: string) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function formatDateTimeTH(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH");
}

export default function SummationPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportId, setReportId] = useState<string>("");

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingSup, setLoadingSup] = useState(false);
  const [loadingApprovals, setLoadingApprovals] = useState(false);

  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [err, setErr] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // load projects
  useEffect(() => {
    let cancel = false;
    async function run() {
      setLoadingProjects(true);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const list: ProjectRow[] = Array.isArray(json)
          ? json.map((p: any) => ({
              id: String(p.id),
              projectName: String(p.projectName || p.name || ""),
            }))
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

  // prefill from sessionStorage (มาจาก preview/commentator)
  useEffect(() => {
    const rid =
      sessionStorage.getItem("lastSubmittedReportId") ||
      sessionStorage.getItem("lastCommentedReportId") ||
      "";
    const pid = sessionStorage.getItem("lastSubmittedProjectId") || "";

    if (pid) setProjectId(pid);
    if (rid) setReportId(rid);
  }, []);

  // load reports list for project
  useEffect(() => {
    let cancel = false;

    async function run() {
      setReports([]);
      setApprovals([]); // clear
      setDetail(null);
      if (!projectId) return;

      setLoadingReports(true);
      try {
        const res = await fetch(
          `/api/daily-reports?projectId=${encodeURIComponent(projectId)}`,
          { cache: "no-store" }
        );
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

  // load supervisors from DB meta.supervisors
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

        const raw = json.project?.meta?.supervisors;
        const arr = Array.isArray(raw) ? raw : [];

        const looksLikeRole = (s: string) => /(ผู้|หัวหน้า|ผอ|วิศวกร|ผู้ตรวจ|ผู้ควบคุม|ผู้แทน)/.test(s);

        const sup: Supervisor[] = arr
          .map((x: any) => {
            if (x && typeof x === "object") {
              return { name: String(x?.name || "").trim(), role: String(x?.role || "").trim() };
            }
            const s = String(x || "").trim();
            if (!s) return { name: "", role: "" };
            return looksLikeRole(s) ? { name: "", role: s } : { name: s, role: "" };
          })
          .filter((x) => x.name); // ต้องมีชื่อเพื่อ match

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

  // load approvals for selected report
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
        if (!cancel) setErr(e?.message ?? "โหลด approvals ไม่สำเร็จ");
      } finally {
        if (!cancel) setLoadingApprovals(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  // load report detail (issues + comments) เพื่อเช็คเงื่อนไขอนุมัติ + แสดงคอมเมนต์ในฟอร์ม
  useEffect(() => {
    let cancel = false;

    async function run() {
      setDetail(null);
      if (!reportId) return;

      setLoadingDetail(true);
      try {
        // ⚠️ ใช้ endpoint เดียวที่รวม issues/comments (ถ้าโปรเจกต์คุณใช้ชื่ออื่น ให้ปรับตรงนี้)
        // ควร return { ok: true, report, issues: [{..., comments:[...]}] }
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as ReportDetail | null;

        if (!res.ok || !json) throw new Error("โหลดรายละเอียดรายงานไม่สำเร็จ");
        // รองรับทั้งแบบ {ok:true,...} และแบบส่งตรง object
        const normalized: ReportDetail = {
          ok: (json as any)?.ok ?? true,
          report: (json as any)?.report ?? null,
          issues: Array.isArray((json as any)?.issues) ? (json as any).issues : [],
        };

        if (!cancel) setDetail(normalized);
      } catch {
        if (!cancel) setDetail({ ok: false, report: null, issues: [] });
      } finally {
        if (!cancel) setLoadingDetail(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  const approvalsMap = useMemo(() => {
    const m = new Map<string, ApprovalRow>();
    for (const a of approvals) m.set(norm(a.approverName), a);
    return m;
  }, [approvals]);

  const issues = useMemo(() => (Array.isArray(detail?.issues) ? detail!.issues! : []), [detail]);
  const issueCount = issues.length;

  const allIssuesHaveAtLeastOneComment = useMemo(() => {
    if (issueCount === 0) return true;
    return issues.every((it) => Array.isArray(it.comments) && it.comments.length > 0);
  }, [issues, issueCount]);

  // ถ้ามี issue แต่ comment ยังไม่ครบ => ห้ามอนุมัติ
  const disableApproveBecauseComments = issueCount > 0 && !allIssuesHaveAtLeastOneComment;

  const allApproved = useMemo(() => {
    if (!supervisors.length) return false;
    if (!reportId) return false;
    return supervisors.every((s) => approvalsMap.has(norm(s.name)));
  }, [supervisors, approvalsMap, reportId]);

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

      // reload approvals
      const res2 = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, {
        cache: "no-store",
      });
      const json2 = await res2.json().catch(() => null);
      if (res2.ok && json2?.ok && Array.isArray(json2.approvals)) setApprovals(json2.approvals);

      // แจ้งชื่อรายงานตาม requirement
      const title = `รายงานการก่อสร้างโครงการ ${json.projectName || ""} ประจำวันที่ ${formatDateBE(
        json.date
      )}`;
      alert(`ยืนยันสำเร็จ ✅\n${title}`);
    } catch (e: any) {
      setErr(e?.message ?? "ยืนยันไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function renderFormBlock() {
    if (!reportId) return null;

    if (loadingDetail) {
      return (
        <div className="mt-4 rounded-2xl border bg-card p-4">
          <div className="opacity-70">กำลังโหลดฟอร์มรายงาน...</div>
        </div>
      );
    }

    // แสดง Preview เสมอ
    return (
      <div className="mt-4 rounded-2xl border bg-card p-4">
        <div className="mb-3">
          {issueCount === 0 ? (
            <div className="text-sm text-green-700">
              ✅ รายงานนี้ไม่มี “ปัญหาและอุปสรรค” → สามารถกด “ยืนยันของฉัน” ได้เลย (ไม่ต้องผ่านแสดงความคิดเห็น)
            </div>
          ) : allIssuesHaveAtLeastOneComment ? (
            <div className="text-sm text-green-700">
              ✅ แสดงความคิดเห็นครบแล้ว → สามารถเข้าสู่ขั้นตอนการอนุมัติได้
            </div>
          ) : (
            <div className="text-sm text-amber-700">
              ⚠️ รายงานนี้มี “ปัญหาและอุปสรรค” แต่ยังแสดงความคิดเห็นไม่ครบทุกข้อ → จะยังไม่สามารถกดอนุมัติได้
            </div>
          )}
        </div>

        <ReportPreviewReadonly reportId={reportId} />

        {/* ถ้ามี Issue และคอมเมนต์ครบแล้ว: แสดงคอมเมนต์ “ในฟอร์ม” ใต้แต่ละ Issue */}
        {issueCount > 0 && allIssuesHaveAtLeastOneComment ? (
          <div className="mt-6 space-y-4">
            <div className="font-semibold">ความเห็น (แสดงในฟอร์ม)</div>

            {issues.map((it, idx) => (
              <div key={it.id} className="rounded-2xl border p-4">
                <div className="font-medium">
                  ปัญหาที่ {idx + 1}
                  {it.title ? `: ${it.title}` : ""}
                </div>
                {it.detail ? <div className="mt-1 text-sm opacity-80 whitespace-pre-wrap">{it.detail}</div> : null}

                <div className="mt-3 rounded-xl border bg-muted/30 p-3">
                  <div className="text-sm font-medium mb-2">รายการความเห็น</div>
                  {(it.comments || []).map((c) => (
                    <div key={c.id} className="mb-2 last:mb-0 rounded-lg border bg-background p-2">
                      <div className="text-xs opacity-70">
                        {c.author?.name || c.author?.email || "ผู้แสดงความคิดเห็น"} • {formatDateTimeTH(c.createdAt)}
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{c.comment}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* ถ้ามี Issue แต่คอมเมนต์ยังไม่ครบ: แสดงคำแนะนำ */}
        {issueCount > 0 && !allIssuesHaveAtLeastOneComment ? (
          <div className="mt-4 rounded-xl border bg-amber-50 p-3 text-sm">
            กรุณาไปที่แท็บ <b>“แสดงความคิดเห็น”</b> เพื่อให้ครบทุก “ปัญหาและอุปสรรค” ก่อน แล้วจึงกลับมาหน้านี้เพื่อกดอนุมัติ
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-3 md:px-6 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">การตรวจสอบและการอนุมัติ</div>
            <div className="text-sm opacity-70">
              เลือกโครงการ → เลือกรายงาน → ผู้ควบคุมงานแต่ละคน login มากด “ยืนยันของฉัน”
            </div>
          </div>
          <button className="rounded-lg border px-3 py-2" onClick={() => router.push("/daily-report")}>
            กลับไปหน้า Daily report
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
                  setReportId(""); // เปลี่ยนโครงการให้รีเซ็ตรายงาน
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
              <div className="text-xs opacity-70 mt-1">ถ้าเด้งมาจาก Preview ระบบจะเลือกให้อัตโนมัติ (ถ้ามี)</div>
            </div>

            <div className="flex items-end">
              <button
                className="w-full rounded-lg border px-3 py-2 disabled:opacity-60"
                disabled={!reportId || saving || disableApproveBecauseComments}
                onClick={onApproveMe}
                title={
                  disableApproveBecauseComments
                    ? "ต้องแสดงความคิดเห็นให้ครบก่อน"
                    : "ผู้ควบคุมงานแต่ละคนต้อง login มากดของตัวเอง"
                }
              >
                {saving ? "กำลังยืนยัน..." : "ยืนยันของฉัน"}
              </button>
            </div>
          </div>

          {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}

          <div className="mt-3 text-sm">
            {reportId ? (
              loadingApprovals ? (
                <span className="opacity-70">กำลังโหลดสถานะการอนุมัติ...</span>
              ) : allApproved ? (
                <span className="font-semibold">อนุมัติครบแล้ว ✅</span>
              ) : (
                <span className="opacity-70">สถานะ: รออนุมัติ</span>
              )
            ) : (
              <span className="opacity-70">เลือก “รายงาน” เพื่อดูสถานะการอนุมัติ</span>
            )}
          </div>
        </div>

        {/* ✅ แสดงฟอร์มรายงาน (Preview) + ความเห็นในฟอร์ม ตามเงื่อนไข */}
        {renderFormBlock()}

        <div className="mt-4 rounded-2xl border bg-card p-4">
          <div className="mb-2 font-semibold">รายชื่อผู้ควบคุมงาน (จาก DB เท่านั้น)</div>

          {loadingSup ? (
            <div className="opacity-70">กำลังโหลดรายชื่อ...</div>
          ) : supervisors.length === 0 ? (
            <div className="opacity-70">ไม่พบรายชื่อผู้ควบคุมงานใน Project.meta.supervisors</div>
          ) : (
            <div className="space-y-2">
              {supervisors.map((s, i) => {
                const a = approvalsMap.get(norm(s.name));
                const ok = Boolean(a);

                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-sm opacity-70">{s.role || ""}</div>
                      {ok ? <div className="text-xs opacity-70 mt-1">ยืนยันเมื่อ: {formatDateBE(a!.approvedAt)}</div> : null}
                    </div>

                    <div className={`rounded-full border px-3 py-1 text-sm ${ok ? "bg-green-50" : "bg-yellow-50"}`}>
                      {ok ? "อนุมัติแล้ว" : "รออนุมัติ"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
