// app/summation/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type ProjectRow = { id: string; projectName: string };
type ReportRow = { id: string; date: string };

type Supervisor = { name: string; role: string };

type ApprovalRow = {
  id: string;
  approverName: string;
  approverRole: string | null;
  approverUserId: string | null;
  approvedAt: string; // ISO string (มาจาก API)
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
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export default function SummationPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

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

  const meDisplay = useMemo(() => {
    const name = String((session as any)?.user?.name || "").trim();
    const email = String((session as any)?.user?.email || "").trim();
    // ให้ name มาก่อน ถ้าไม่มีใช้ email
    return name || email || "";
  }, [session]);

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

  // prefill from sessionStorage
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
      setReportId((prev) => (projectId ? prev : "")); // ถ้าเคลียร์ project ก็เคลียร์ report
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

  // load supervisors from /api/projects/[id] meta.supervisors (DB only)
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
        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลดรายชื่อผู้ควบคุมงานไม่สำเร็จ");

        const raw = json.project?.meta?.supervisors;
        const arr = Array.isArray(raw) ? raw : [];

        const looksLikeRole = (s: string) =>
          /(ผู้|หัวหน้า|ผอ|วิศวกร|ผู้ตรวจ|ผู้ควบคุม|ผู้แทน)/.test(s);

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
        if (!cancel) setErr(e?.message ?? "โหลดรายชื่อผู้ควบคุมงานไม่สำเร็จ");
      } finally {
        if (!cancel) setLoadingSup(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [projectId]);

  // load approvals for report
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
        if (!res.ok || !json?.ok) throw new Error(json?.message || "โหลดสถานะการอนุมัติไม่สำเร็จ");

        const list: ApprovalRow[] = Array.isArray(json?.approvals)
          ? json.approvals.map((a: any) => ({
              id: String(a.id),
              approverName: String(a.approverName || ""),
              approverRole: a.approverRole == null ? null : String(a.approverRole),
              approverUserId: a.approverUserId == null ? null : String(a.approverUserId),
              approvedAt: String(a.approvedAt || ""),
            }))
          : [];

        if (!cancel) setApprovals(list);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? "โหลดสถานะการอนุมัติไม่สำเร็จ");
      } finally {
        if (!cancel) setLoadingApprovals(false);
      }
    }
    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  const approvedNameSet = useMemo(() => {
    const s = new Set<string>();
    approvals.forEach((a) => {
      const k = norm(a.approverName);
      if (k) s.add(k);
    });
    return s;
  }, [approvals]);

  const totalSup = supervisors.filter((s) => norm(s.name)).length; // นับเฉพาะรายการที่มีชื่อ
  const approvedCount = useMemo(() => {
    if (!supervisors.length) return 0;
    let c = 0;
    for (const sup of supervisors) {
      const k = norm(sup.name);
      if (!k) continue;
      if (approvedNameSet.has(k)) c++;
    }
    return c;
  }, [supervisors, approvedNameSet]);

  const isFullyApproved = totalSup > 0 && approvedCount >= totalSup;

  const mySupervisor = useMemo(() => {
    const me = norm(meDisplay);
    if (!me) return null;
    // match ชื่อ supervisor เท่านั้น (ตาม requirement)
    return supervisors.find((s) => norm(s.name) === me) || null;
  }, [supervisors, meDisplay]);

  const iCanApprove = useMemo(() => {
    if (!projectId || !reportId) return false;
    if (status === "loading") return false;
    if (!meDisplay) return false;
    if (!mySupervisor) return false;
    // ถ้าเคยอนุมัติแล้ว กดซ้ำไม่ได้
    if (approvedNameSet.has(norm(mySupervisor.name))) return false;
    return true;
  }, [projectId, reportId, status, meDisplay, mySupervisor, approvedNameSet]);

  async function onApproveMe() {
    setErr("");
    if (!projectId || !reportId) {
      setErr("กรุณาเลือกโครงการและรายงานก่อน");
      return;
    }
    if (!iCanApprove) {
      setErr("คุณไม่มีสิทธิ์ยืนยัน (ต้องเป็นผู้ควบคุมงานที่มีชื่ออยู่ในรายชื่อ)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ส่ง projectId ไปเผื่อฝั่ง API ใช้ตรวจ/หา supervisors (ปลอดภัย)
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.message || "บันทึกการอนุมัติไม่สำเร็จ");

      // refresh approvals
      const res2 = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}/approvals`, {
        cache: "no-store",
      });
      const json2 = await res2.json().catch(() => null);
      if (res2.ok && json2?.ok) {
        const list: ApprovalRow[] = Array.isArray(json2?.approvals)
          ? json2.approvals.map((a: any) => ({
              id: String(a.id),
              approverName: String(a.approverName || ""),
              approverRole: a.approverRole == null ? null : String(a.approverRole),
              approverUserId: a.approverUserId == null ? null : String(a.approverUserId),
              approvedAt: String(a.approvedAt || ""),
            }))
          : [];
        setApprovals(list);
      }

      // เก็บเพื่อใช้งานต่อ
      sessionStorage.setItem("lastSubmittedProjectId", String(projectId));
      sessionStorage.setItem("lastSubmittedReportId", String(reportId));
    } catch (e: any) {
      setErr(e?.message ?? "บันทึกการอนุมัติไม่สำเร็จ");
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
              เลือกโครงการ → เลือกรายงาน → ผู้ควบคุมงานแต่ละคนกด “ยืนยันของฉัน” ด้วยบัญชีตัวเอง
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
                  setReportId("");
                  setApprovals([]);
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
              <div className="text-xs opacity-70 mt-1">ถ้าเด้งมาจาก Preview ระบบจะเลือกให้อัตโนมัติ</div>
            </div>

            <div className="flex flex-col justify-end gap-2">
              <div className="text-xs opacity-70">
                ผู้ใช้งาน:{" "}
                {status === "loading" ? "กำลังโหลด..." : meDisplay ? meDisplay : "ไม่พบข้อมูลผู้ใช้งาน (กรุณา login)"}
              </div>

              <button
                className="w-full rounded-lg border px-3 py-2 disabled:opacity-60"
                disabled={!iCanApprove || saving}
                onClick={onApproveMe}
                title={
                  !meDisplay
                    ? "กรุณา login"
                    : !mySupervisor
                    ? "ชื่อผู้ใช้ต้องตรงกับรายชื่อผู้ควบคุมงาน"
                    : approvedNameSet.has(norm(mySupervisor.name))
                    ? "คุณอนุมัติแล้ว"
                    : "ยืนยันของฉัน"
                }
              >
                {saving ? "กำลังบันทึก..." : "ยืนยันของฉัน"}
              </button>

              <div className="text-sm">
                สถานะ:{" "}
                <span className="font-semibold">
                  {totalSup === 0 ? "-" : `${approvedCount}/${totalSup} คน`}
                </span>{" "}
                {isFullyApproved ? <span className="ml-2 text-green-700 font-semibold">อนุมัติครบแล้ว</span> : null}
              </div>
            </div>
          </div>

          {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
        </div>

        <div className="mt-4 rounded-2xl border bg-card p-4">
          <div className="mb-2 font-semibold">รายชื่อผู้ควบคุมงาน + สถานะการอนุมัติ (จาก DB)</div>

          {loadingSup ? (
            <div className="opacity-70">กำลังโหลดรายชื่อผู้ควบคุมงาน...</div>
          ) : supervisors.length === 0 ? (
            <div className="opacity-70">ไม่พบรายชื่อผู้ควบคุมงานใน Project.meta.supervisors</div>
          ) : (
            <div className="space-y-2">
              {supervisors.map((s, i) => {
                const key = norm(s.name);
                const ok = key ? approvedNameSet.has(key) : false;
                const who = key ? s.name : "(ไม่ระบุชื่อ)";
                const isMe = key && norm(meDisplay) === key;

                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {who} {isMe ? <span className="ml-2 text-xs rounded bg-black/5 px-2 py-0.5">คุณ</span> : null}
                      </div>
                      <div className="text-sm opacity-70">{s.role || ""}</div>
                    </div>

                    <div className="shrink-0">
                      {ok ? (
                        <div className="text-sm font-semibold text-green-700">
                          อนุมัติแล้ว
                          <div className="text-xs opacity-70 text-right">
                            {(() => {
                              const a = approvals.find((x) => norm(x.approverName) === key);
                              return a?.approvedAt ? formatDateBE(a.approvedAt) : "";
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-amber-700">รออนุมัติ</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loadingApprovals ? <div className="mt-3 text-sm opacity-70">กำลังโหลดสถานะการอนุมัติ...</div> : null}

          {isFullyApproved ? (
            <div className="mt-4 rounded-xl border bg-green-50 p-3">
              <div className="font-semibold text-green-800">อนุมัติครบทุกคนแล้ว</div>
              <div className="text-sm text-green-800 mt-1">
                ระบบสามารถถือว่ารายงาน “รายงานการก่อสร้างโครงการ... ประจำวันที่ ...” เสร็จสมบูรณ์ได้แล้ว
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
