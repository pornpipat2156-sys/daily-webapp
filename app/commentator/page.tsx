// app/commentator/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ReportPreviewReadonly } from "@/components/ReportPreviewReadonly";

type ProjectRow = { id: string; projectName: string };
type ReportRow = { id: string; date: string }; // ISO string

type Author = { id: string; email: string; name: string | null; role: string };
type IssueComment = { id: string; comment: string; createdAt: string; author: Author };
type Issue = { id: string; detail: string; imageUrl: string | null; createdAt: string; comments: IssueComment[] };

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

type ReportDetail = {
  id: string;
  projectId: string;
  date: string;
  projectName: string;
  projectMeta: ProjectMeta | null;
  issues: Issue[];
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

  // comment draft per issue
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [submittingAll, setSubmittingAll] = useState(false);

  // 1) load projects
  useEffect(() => {
    let cancel = false;
    async function run() {
      setLoadingProjects(true);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        // /api/projects ของคุณ return เป็น array
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

  // 3) load reports for selected project (ถ้า reportId ยังไม่ถูก set หรือ user อยากเลือกเอง)
  useEffect(() => {
    let cancel = false;
    async function run() {
      setReports([]);
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
          setDetail(json.report as ReportDetail);

          // init draft empty
          const init: Record<string, string> = {};
          for (const it of (json.report?.issues || []) as Issue[]) init[it.id] = "";
          setDraft(init);
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

  const canShowReport = Boolean(projectId && reportId && detail);

  const issueCount = useMemo(() => detail?.issues?.length ?? 0, [detail]);
  const allIssuesHaveAtLeastOneComment = useMemo(() => {
    const list = detail?.issues || [];
    if (!list.length) return true; // ถ้าไม่มี issue แปลว่าไม่ควรมาแท็บนี้ แต่กันพังไว้
    return list.every((it) => (it.comments || []).length > 0);
  }, [detail]);

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

      // reload detail to get latest comments
      const again = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, { cache: "no-store" });
      const againJson = await again.json().catch(() => null);
      if (again.ok && againJson?.ok) setDetail(againJson.report as ReportDetail);

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

    // ต้องมีความเห็นครบทุก issue
    if (!allIssuesHaveAtLeastOneComment) {
      setErr("ยังแสดงความคิดเห็นไม่ครบทุกปัญหา กรุณาใส่ความเห็นให้ครบก่อนกดส่ง");
      return;
    }

    setSubmittingAll(true);
    try {
      // (optional) mark state ว่าผ่านขั้น comment แล้ว
      sessionStorage.setItem("lastCommentedReportId", detail.id);
      router.push("/summation");
    } finally {
      setSubmittingAll(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-3 md:px-6 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">การแสดงความคิดเห็น</div>
            <div className="text-sm opacity-70">
              เลือกโครงการ → เลือกรายงาน → แสดงความคิดเห็นครบทุกปัญหา → กดส่งเพื่อไป “การตรวจสอบและการอนุมัติ”
            </div>
          </div>
          <button className="rounded-lg border px-3 py-2" onClick={() => router.push("/daily-report")}>
            กลับไปกรอก Daily report
          </button>
        </div>

        {/* Select Project */}
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
              <div className="text-xs opacity-70 mt-1">
                ถ้าเด้งมาจาก Preview ระบบจะเลือกให้อัตโนมัติ (report ล่าสุดที่เพิ่งส่ง)
              </div>
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

        {/* Report detail */}
        <div className="mt-4">
          {!reportId ? null : loadingDetail ? (
            <div className="rounded-xl border bg-card p-4 opacity-80">กำลังโหลดข้อมูลรายงาน...</div>
          ) : !detail ? (
            <div className="rounded-xl border bg-card p-4 opacity-80">ยังไม่พบข้อมูลรายงาน</div>
          ) : (
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {detail.projectName} — วันที่ {formatDateBE(detail.date)}
                  </div>
                  <div className="text-sm opacity-70">จำนวนปัญหา: {issueCount}</div>
                </div>
                <div className="text-sm">
                  สถานะความเห็น:{" "}
                  <span className={allIssuesHaveAtLeastOneComment ? "text-green-600" : "text-amber-600"}>
                    {allIssuesHaveAtLeastOneComment ? "ครบแล้ว" : "ยังไม่ครบ"}
                  </span>
                </div>
              </div>

              {/* Show Issues + comment box */}
              {(detail.issues || []).length === 0 ? (
                <div className="opacity-70">รายงานนี้ไม่มี “ปัญหาและอุปสรรค” (ปกติควรไปแท็บตรวจสอบและอนุมัติ)</div>
              ) : (
                <div className="space-y-4">
                  {detail.issues.map((it, idx) => (
                    <div key={it.id} className="rounded-2xl border p-4">
                      <div className="font-semibold mb-2">ปัญหาที่ {idx + 1}</div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="md:col-span-1">
                          <div className="text-sm font-medium mb-1">ภาพ</div>
                          {it.imageUrl ? (
                            <img
                              src={it.imageUrl}
                              alt={`issue-${idx + 1}`}
                              className="w-full max-h-[240px] object-contain rounded-lg border"
                            />
                          ) : (
                            <div className="rounded-lg border p-6 text-center opacity-70">-</div>
                          )}
                        </div>

                        <div className="md:col-span-1">
                          <div className="text-sm font-medium mb-1">รายละเอียด</div>
                          <div className="rounded-lg border p-3 whitespace-pre-wrap min-h-[120px]">{it.detail || "-"}</div>
                        </div>

                        <div className="md:col-span-1">
                          <div className="text-sm font-medium mb-1">ความเห็นของผู้ควบคุมงาน</div>
                          <textarea
                            className="w-full rounded-lg border p-3 min-h-[120px] bg-background"
                            placeholder="พิมพ์ความเห็น..."
                            value={draft[it.id] ?? ""}
                            onChange={(e) => setDraft((m) => ({ ...m, [it.id]: e.target.value }))}
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="text-xs opacity-70">ความเห็นเดิม: {(it.comments || []).length} รายการ</div>
                            <button
                              className="rounded-lg border px-3 py-2 disabled:opacity-60"
                              disabled={posting[it.id] || !(draft[it.id] || "").trim()}
                              onClick={() => postComment(it.id)}
                            >
                              {posting[it.id] ? "กำลังส่ง..." : "ส่งความเห็น"}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* comments list */}
                      {(it.comments || []).length > 0 ? (
                        <div className="mt-3 rounded-xl border p-3">
                          <div className="text-sm font-medium mb-2">รายการความเห็น</div>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4">{reportId ? <ReportPreviewReadonly reportId={reportId} /> : null}</div>
      </div>
    </div>
  );
}
