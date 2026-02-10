// components/ReportPreviewReadonly.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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
  images?: string[] | { url: string }[];
  comments?: IssueCommentRow[];
};

type AnyJson = Record<string, any>;

type Props = {
  reportId: string;
  /** ถ้าต้องการให้คอมเมนต์แสดงใต้ Issue ในฟอร์มด้วย */
  includeIssueComments?: boolean;
  className?: string;
};

function fmtDateBE(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDateTimeTH(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH");
}

function get(obj: any, path: string[]) {
  let cur = obj;
  for (const k of path) {
    if (cur && typeof cur === "object" && k in cur) cur = cur[k];
    else return undefined;
  }
  return cur;
}

function pickFirst(obj: any, paths: string[][]) {
  for (const p of paths) {
    const v = get(obj, p);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function safeText(v: any) {
  if (v === undefined || v === null) return "";
  return String(v);
}

function isArr(a: any): a is any[] {
  return Array.isArray(a);
}

export function ReportPreviewReadonly({ reportId, includeIssueComments = false, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const [raw, setRaw] = useState<AnyJson | null>(null);

  useEffect(() => {
    let cancel = false;

    async function run() {
      setErr("");
      setRaw(null);
      if (!reportId) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/daily-reports/${encodeURIComponent(reportId)}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as AnyJson | null;
        if (!res.ok || !json) throw new Error(json?.message || "โหลดข้อมูลรายงานไม่สำเร็จ");
        if (!cancel) setRaw(json);
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? "โหลดข้อมูลรายงานไม่สำเร็จ");
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    run();
    return () => {
      cancel = true;
    };
  }, [reportId]);

  // ---- normalize data ----
  const report = useMemo(() => {
    if (!raw) return null;
    // รองรับ: {report:{...}} หรือส่งตรง
    return (raw.report && typeof raw.report === "object" ? raw.report : raw) as AnyJson;
  }, [raw]);

  const payload = useMemo(() => {
    if (!raw) return null;
    // รองรับ: raw.payload / raw.data / report.payload / report.data
    const v =
      pickFirst(raw, [["payload"], ["data"], ["report", "payload"], ["report", "data"]]) ??
      pickFirst(raw, [["dailyReportPayload"], ["report", "dailyReportPayload"]]);
    return (v && typeof v === "object" ? v : null) as AnyJson | null;
  }, [raw]);

  const meta = useMemo(() => {
    if (!raw) return null;
    const v = pickFirst(raw, [["meta"], ["projectMeta"], ["report", "meta"], ["report", "projectMeta"]]);
    return (v && typeof v === "object" ? v : null) as AnyJson | null;
  }, [raw]);

  const issues: IssueRow[] = useMemo(() => {
    const v = pickFirst(raw, [["issues"], ["report", "issues"]]);
    if (isArr(v)) return v as IssueRow[];
    // บางระบบเก็บใน payload
    const v2 = pickFirst(payload, [["issues"], ["problemIssues"], ["issueList"]]);
    return isArr(v2) ? (v2 as IssueRow[]) : [];
  }, [raw, payload]);

  const titleProject = useMemo(() => {
    return (
      pickFirst(raw, [["projectName"], ["report", "projectName"], ["project", "projectName"], ["project", "name"]]) ??
      pickFirst(meta, [["projectName"], ["name"]]) ??
      "-"
    );
  }, [raw, meta]);

  const reportDate = useMemo(() => {
    const d =
      pickFirst(report, [["date"], ["reportDate"]]) ??
      pickFirst(raw, [["date"], ["reportDate"]]) ??
      pickFirst(payload, [["date"], ["reportDate"]]);
    return safeText(d);
  }, [report, raw, payload]);

  // ตัวอย่าง field ที่เจอบ่อย ๆ ในฟอร์มรายงาน (ถ้าไม่มี ก็ไม่แสดง/แสดง "-")
  const contractNo = useMemo(() => safeText(pickFirst(meta, [["contractNo"]]) ?? ""), [meta]);
  const annexNo = useMemo(() => safeText(pickFirst(meta, [["annexNo"]]) ?? ""), [meta]);
  const periodNo = useMemo(() => safeText(pickFirst(meta, [["periodNo"]]) ?? ""), [meta]);
  const weekNo = useMemo(() => safeText(pickFirst(meta, [["weekNo"]]) ?? ""), [meta]);
  const siteLocation = useMemo(() => safeText(pickFirst(meta, [["siteLocation"]]) ?? ""), [meta]);

  const weather = useMemo(() => {
    // รองรับหลายชื่อ
    const w =
      pickFirst(payload, [["weather"], ["weatherText"], ["weatherSummary"]]) ??
      pickFirst(report, [["weather"], ["weatherText"], ["weatherSummary"]]);
    return safeText(w);
  }, [payload, report]);

  // ---- UI ----
  if (!reportId) return null;

  if (loading) {
    return (
      <div className={className}>
        <div className="rounded-2xl border bg-card p-4 opacity-80">กำลังโหลดฟอร์มรายงาน...</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className={className}>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-sm text-red-600">{err}</div>
        </div>
      </div>
    );
  }

  if (!raw) return null;

  return (
    <div className={className}>
      <div className="rounded-2xl border bg-card">
        {/* Header */}
        <div className="border-b p-4">
          <div className="text-lg font-semibold">แบบฟอร์มรายงานประจำวัน (Preview)</div>
          <div className="text-sm opacity-70 mt-1">
            โครงการ: <span className="font-medium opacity-100">{titleProject}</span>
            {" • "}
            วันที่: <span className="font-medium opacity-100">{fmtDateBE(reportDate)}</span>
          </div>
        </div>

        {/* Meta summary */}
        <div className="p-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium mb-2">ข้อมูลสัญญา</div>
            <div className="text-sm space-y-1">
              <div>
                เลขที่สัญญา: <span className="font-medium">{contractNo || "-"}</span>
              </div>
              <div>
                ภาคผนวก: <span className="font-medium">{annexNo || "-"}</span>
              </div>
              <div>
                งวด: <span className="font-medium">{periodNo || "-"}</span>
              </div>
              <div>
                สัปดาห์: <span className="font-medium">{weekNo || "-"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium mb-2">ข้อมูลหน้างาน</div>
            <div className="text-sm space-y-1">
              <div>
                สถานที่ก่อสร้าง: <span className="font-medium">{siteLocation || "-"}</span>
              </div>
              <div>
                สภาพอากาศ: <span className="font-medium">{weather || "-"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payload render (generic) */}
        <div className="px-4 pb-4">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium mb-2">ข้อมูลรายงาน (อ่านจาก payload)</div>
            <div className="text-xs opacity-70 mb-2">
              * ส่วนนี้เป็นการแสดงผลแบบปลอดภัย (readonly) หาก field ในระบบคุณต่างออกไปก็ยังไม่พัง
            </div>

            {payload ? (
              <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted/20 rounded-lg border p-3 overflow-auto">
                {JSON.stringify(payload, null, 2)}
              </pre>
            ) : (
              <div className="text-sm opacity-70">ไม่พบ payload ในรายงานนี้</div>
            )}
          </div>
        </div>

        {/* Issues */}
        <div className="px-4 pb-4">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium mb-2">ปัญหาและอุปสรรค (Issues)</div>

            {issues.length === 0 ? (
              <div className="text-sm text-green-700">ไม่มีปัญหาและอุปสรรค ✅</div>
            ) : (
              <div className="space-y-3">
                {issues.map((it, idx) => {
                  const imgs = isArr(it.images) ? it.images : [];
                  const comments = isArr(it.comments) ? it.comments : [];

                  return (
                    <div key={it.id} className="rounded-xl border p-3">
                      <div className="font-medium">
                        ปัญหาที่ {idx + 1}
                        {it.title ? `: ${it.title}` : ""}
                      </div>
                      {it.detail ? (
                        <div className="mt-1 text-sm whitespace-pre-wrap opacity-90">{it.detail}</div>
                      ) : (
                        <div className="mt-1 text-sm opacity-60">-</div>
                      )}

                      {/* images (optional) */}
                      {imgs.length > 0 ? (
                        <div className="mt-3">
                          <div className="text-sm font-medium mb-2">รูปประกอบ</div>
                          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {imgs.map((x: any, i: number) => {
                              const url = typeof x === "string" ? x : safeText(x?.url);
                              if (!url) return null;
                              return (
                                <div key={i} className="rounded-lg border overflow-hidden bg-muted/10">
                                  {/* ใช้ img เพื่อลดปัญหา domain ของ next/image */}
                                  <img src={url} alt={`issue-${idx + 1}-${i + 1}`} className="w-full h-auto block" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* comments in form */}
                      {includeIssueComments ? (
                        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
                          <div className="text-sm font-medium mb-2">ความเห็น</div>
                          {comments.length === 0 ? (
                            <div className="text-sm opacity-70">ยังไม่มีความเห็น</div>
                          ) : (
                            <div className="space-y-2">
                              {comments.map((c) => (
                                <div key={c.id} className="rounded-lg border bg-background p-2">
                                  <div className="text-xs opacity-70">
                                    {c.author?.name || c.author?.email || "ผู้แสดงความคิดเห็น"} •{" "}
                                    {fmtDateTimeTH(c.createdAt)}
                                  </div>
                                  <div className="text-sm whitespace-pre-wrap">{c.comment}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 text-xs opacity-70">
          แสดงผลแบบอ่านอย่างเดียว (Readonly) สำหรับการตรวจสอบ/อนุมัติ • reportId: {reportId}
        </div>
      </div>
    </div>
  );
}
