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
      if (!projectId) return;

      setLoadingReports(true);
      try {
        const res = await fetch(`/api/daily-reports?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        const list: ReportRow[] = Array.isArray(json?.reports)
          ? json.reports.map((r: any) => ({ id: String(r.id), date: String(r.date) }))
          : [];
        if (!cancel) setReports(list);

        // ถ้ามี reportId อยู่แล้ว (prefill) แต่ไม่อยู่ใน list ก็ไม่บังคับรีเซ็ต
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
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
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

  async function onApproveMe() {
    setErr("");
    if (!reportId) {
      setErr("กรุณาเลือกรายงานก่อน");
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
      const title = `รายงานการก่อสร้างโครงการ ${json.projectName || ""} ประจำวันที่ ${formatDateBE(json.date)}`;
      alert(`ยืนยันสำเร็จ ✅\n${title}`);
    } catch (e: any) {
      setErr(e?.message ?? "ยืนยันไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
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
                disabled={!reportId || saving}
                onClick={onApproveMe}
                title="ผู้ควบคุมงานแต่ละคนต้อง login มากดของตัวเอง"
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
        <div className="mt-4">{reportId ? <ReportPreviewReadonly reportId={reportId} /> : null}</div>
      </div>
    </div>
  );
}
