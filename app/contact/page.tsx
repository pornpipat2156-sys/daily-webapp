// app/contact/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ReportPreviewReadonly } from "@/components/ReportPreviewReadonly";

type ProjectRow = { id: string; projectName: string };

type AllowUserRow = {
  id: string; // userId
  email: string;
  name: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN" | string;
};

type ChatMemberRow = AllowUserRow;

type ChatMessage = {
  id: string;
  projectId: string;
  author: { id: string; email: string; name: string | null; role: string | null };
  text: string | null;
  createdAt: string;
  reportId: string | null;
  mentionUserIds: string[];
};

type DailyReportRow = { id: string; date: string }; // YYYY-MM-DD

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `GET ${url} failed`);
  try {
    return JSON.parse(txt) as T;
  } catch {
    throw new Error(txt || `GET ${url} invalid json`);
  }
}

async function jpost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `POST ${url} failed`);
  try {
    return JSON.parse(txt) as T;
  } catch {
    throw new Error(txt || `POST ${url} invalid json`);
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function ContactPage() {
  const { data: session, status } = useSession();

  const role = (session as any)?.user?.role as string | undefined;
  const meId = (session as any)?.user?.id as string | undefined;

  const isSuperAdmin = role === "SUPERADMIN";

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  // allowlist (เลือกเพื่อ add)
  const [allowUsers, setAllowUsers] = useState<AllowUserRow[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  // group members (ใช้สำหรับ @mention)
  const [groupMembers, setGroupMembers] = useState<ChatMemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // chat messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // + ส่ง Daily Report
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [reportIdToSend, setReportIdToSend] = useState<string>("");

  // @mention
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchor, setMentionAnchor] = useState<{ start: number; end: number } | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const canPickProject = isSuperAdmin;

  // โหลด projects
  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const rows = await jget<ProjectRow[]>("/api/projects?scope=chat");
      setProjects(rows);
      if (!projectId && rows.length) setProjectId(rows[0].id);
    })().catch((e) => {
      console.error(e);
      alert(`โหลดโครงการไม่สำเร็จ: ${String(e?.message || e)}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // โหลด allowlist ของ project
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const rows = await jget<AllowUserRow[]>(`/api/allow-email?projectId=${encodeURIComponent(projectId)}`);
      setAllowUsers(rows);
      setSelectedToAdd({});
    })().catch((e) => {
      console.error(e);
      alert(`โหลด AllowEmail ไม่สำเร็จ: ${String(e?.message || e)}`);
    });
  }, [projectId]);

  // โหลดสมาชิกในกลุ่มจริง (สำหรับ mention)
  useEffect(() => {
    if (!projectId) return;
    setLoadingMembers(true);
    (async () => {
      const rows = await jget<ChatMemberRow[]>(`/api/chat/members?projectId=${encodeURIComponent(projectId)}`);
      setGroupMembers(rows);
    })()
      .catch((e) => {
        console.error(e);
        // ไม่ alert ทุกครั้ง กันรำคาญ (แต่จะเห็นใน console)
      })
      .finally(() => setLoadingMembers(false));
  }, [projectId]);

  // โหลดข้อความ
  useEffect(() => {
    if (!projectId) return;
    setLoadingMessages(true);
    (async () => {
      const rows = await jget<ChatMessage[]>(`/api/chat/messages?projectId=${encodeURIComponent(projectId)}`);
      setMessages(rows);
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "auto" });
      }, 50);
    })()
      .catch((e) => {
        console.error(e);
        alert(`โหลดข้อความไม่สำเร็จ: ${String(e?.message || e)}`);
      })
      .finally(() => setLoadingMessages(false));
  }, [projectId]);

  // โหลดรายงานไว้ให้เลือกตอนกด +
  useEffect(() => {
    if (!pickerOpen || !projectId) return;
    (async () => {
      const rows = await jget<DailyReportRow[]>(
        `/api/daily-reports?projectId=${encodeURIComponent(projectId)}&mode=picker`
      );
      setReports(rows);
      if (!reportIdToSend && rows.length) setReportIdToSend(rows[0].id);
    })().catch((e) => {
      console.error(e);
      alert(`โหลดรายการ Daily Report ไม่สำเร็จ: ${String(e?.message || e)}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen, projectId]);

  const selectedAddIds = useMemo(
    () => Object.entries(selectedToAdd).filter(([, v]) => v).map(([k]) => k),
    [selectedToAdd]
  );

  async function refreshMembersAndMessages() {
    if (!projectId) return;
    try {
      const [memRows, msgRows] = await Promise.all([
        jget<ChatMemberRow[]>(`/api/chat/members?projectId=${encodeURIComponent(projectId)}`),
        jget<ChatMessage[]>(`/api/chat/messages?projectId=${encodeURIComponent(projectId)}`),
      ]);
      setGroupMembers(memRows);
      setMessages(msgRows);
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "auto" });
      }, 30);
    } catch (e) {
      console.error(e);
    }
  }

  async function addMembersToGroup() {
    if (!projectId || selectedAddIds.length === 0) return;
    setAdding(true);
    try {
      await jpost(`/api/chat/members/add`, { projectId, userIds: selectedAddIds });
      setSelectedToAdd({});
      await refreshMembersAndMessages();
    } catch (e: any) {
      console.error(e);
      alert(`เพิ่มสมาชิกไม่สำเร็จ: ${String(e?.message || e)}`);
    } finally {
      setAdding(false);
    }
  }

  // ===== Mention: ใช้ groupMembers เท่านั้น (ถูกต้องตาม requirement) =====
  const mentionCandidates = useMemo(() => {
    const src = groupMembers;
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return src.slice(0, 8);
    return src
      .filter((m) => (m.name ?? m.email).toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [groupMembers, mentionQuery]);

  function handleTextChange(v: string) {
    setText(v);

    const el = inputRef.current;
    if (!el) return;

    const caret = el.selectionStart ?? v.length;
    const left = v.slice(0, caret);
    const at = left.lastIndexOf("@");
    if (at === -1) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionAnchor(null);
      return;
    }

    const prev = left[at - 1];
    const okBoundary = at === 0 || prev === " " || prev === "\n" || prev === "\t";
    if (!okBoundary) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionAnchor(null);
      return;
    }

    const query = left.slice(at + 1);
    if (/\s/.test(query)) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionAnchor(null);
      return;
    }

    setMentionOpen(true);
    setMentionQuery(query);
    setMentionAnchor({ start: at, end: caret });
  }

  function insertMention(user: AllowUserRow) {
    const el = inputRef.current;
    if (!el || !mentionAnchor) return;

    const display = user.name?.trim() ? user.name.trim() : user.email;
    const before = text.slice(0, mentionAnchor.start);
    const after = text.slice(mentionAnchor.end);

    const token = `@${display}`;
    const next = `${before}${token} ${after}`;
    setText(next);

    requestAnimationFrame(() => {
      const pos = (before + token + " ").length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });

    setMentionOpen(false);
    setMentionQuery("");
    setMentionAnchor(null);
  }

  function extractMentionUserIdsFromText(v: string) {
    // map จาก "@ชื่อ/อีเมล" -> userId เฉพาะคนที่อยู่ใน groupMembers
    const ids: string[] = [];
    for (const m of groupMembers) {
      const display = m.name?.trim() ? m.name.trim() : m.email;
      const re = new RegExp(`(^|\\s)@${escapeRegExp(display)}(\\s|$)`, "g");
      if (re.test(v)) ids.push(m.id);
    }
    return Array.from(new Set(ids));
  }

  async function sendMessage(opts?: { reportId?: string | null }) {
    if (!projectId) return;

    const hasText = text.trim().length > 0;
    const repId = opts?.reportId ?? null;

    if (!hasText && !repId) return;

    setSending(true);
    try {
      const mentionUserIds = extractMentionUserIdsFromText(text);

      await jpost<ChatMessage>("/api/chat/messages", {
        projectId,
        text: hasText ? text.trim() : null,
        reportId: repId,
        mentionUserIds,
      });

      setText("");
      setPickerOpen(false);
      // ไม่ reset reportIdToSend ให้เลือกได้ต่อ (กัน UX พัง)
      await refreshMembersAndMessages();
    } catch (e: any) {
      console.error(e);
      alert(`ส่งข้อความไม่สำเร็จ: ${String(e?.message || e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-0px)] p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-lg font-semibold">Contact (Project Group Chat)</div>
            <div className="text-sm text-gray-600">เก็บ log การพูดคุย + แนบ Daily Report Preview ลงกลุ่มได้</div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="text-sm text-gray-700">โครงการ</label>
            <select
              className={cn(
                "h-10 w-full rounded-xl border px-3 text-sm md:w-[320px]",
                !canPickProject && "bg-gray-100 text-gray-500"
              )}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!canPickProject}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName}
                </option>
              ))}
            </select>

            {/* ✅ ลบการแสดง Role ตามที่สั่ง */}
          </div>
        </div>

        {/* Member management (SuperAdmin only) */}
        {isSuperAdmin ? (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="font-semibold">เพิ่มผู้เข้าร่วมกลุ่ม</div>
                <div className="text-sm text-gray-600">เลือกจาก AllowEmail (เพิ่มหลายคนพร้อมกันได้)</div>
              </div>

              <button
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-medium",
                  selectedAddIds.length === 0 || adding
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-black text-white"
                )}
                disabled={selectedAddIds.length === 0 || adding}
                onClick={addMembersToGroup}
              >
                {adding ? "กำลังเพิ่ม..." : `Add (${selectedAddIds.length})`}
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {allowUsers.map((m) => {
                const label = m.name?.trim() ? m.name : m.email;
                return (
                  <label key={m.id} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={!!selectedToAdd[m.id]}
                      onChange={(e) => setSelectedToAdd((p) => ({ ...p, [m.id]: e.target.checked }))}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{label}</div>
                      <div className="truncate text-xs text-gray-500">{m.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Chat */}
        <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          {/* Message list + composer */}
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-4">
              <div className="font-semibold">ห้องแชท</div>
              <div className="text-sm text-gray-600">
                โครงการ:{" "}
                <span className="font-medium">{projects.find((p) => p.id === projectId)?.projectName ?? "-"}</span>
              </div>
            </div>

            <div ref={listRef} className="h-[58vh] overflow-auto p-4">
              {loadingMessages ? (
                <div className="text-sm text-gray-500">กำลังโหลดข้อความ...</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-gray-500">ยังไม่มีข้อความ</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const mine = !!meId && msg.author.id === meId;
                    const authorLabel = msg.author.name?.trim() ? msg.author.name : msg.author.email;

                    return (
                      <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[92%] rounded-2xl border p-3 md:max-w-[80%]",
                            mine ? "bg-gray-50" : "bg-white"
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <div className="min-w-0 text-xs text-gray-600">
                              <span className="truncate font-medium text-gray-800">{authorLabel}</span>
                            </div>
                            <div className="shrink-0 text-[11px] text-gray-500">{fmtDateTime(msg.createdAt)}</div>
                          </div>

                          {/* ✅ แนบรายงาน: Preview ก่อนเสมอ */}
                          {msg.reportId ? (
                            <div className="mb-2 rounded-xl border bg-white p-2">
                              <div className="mb-2 text-xs font-medium text-gray-700">Daily Report Preview (Read-only)</div>
                              <div className="overflow-hidden rounded-xl">
                                <ReportPreviewReadonly reportId={msg.reportId} />
                              </div>
                            </div>
                          ) : null}

                          {msg.text ? (
                            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{msg.text}</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t p-3">
              <div className="relative">
                {/* Mention dropdown */}
                {mentionOpen && mentionCandidates.length > 0 ? (
                  <div className="absolute bottom-[92px] left-0 z-20 w-full rounded-2xl border bg-white p-2 shadow-lg">
                    <div className="px-2 pb-1 text-xs font-medium text-gray-600">
                      Mention {loadingMembers ? "(กำลังโหลดสมาชิก...)" : ""}
                    </div>
                    <div className="max-h-48 overflow-auto">
                      {mentionCandidates.map((u) => {
                        const label = u.name?.trim() ? u.name : u.email;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => insertMention(u)}
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">{label}</div>
                              <div className="truncate text-xs text-gray-500">{u.email}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <textarea
                  ref={inputRef}
                  className="h-20 w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="พิมพ์ข้อความ... ใช้ @ เพื่อ mention คนในกลุ่ม"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* + picker */}
                    <button
                      type="button"
                      className="h-10 w-10 rounded-xl border text-lg hover:bg-gray-50"
                      onClick={() => setPickerOpen((v) => !v)}
                      title="แนบ Daily Report Preview"
                    >
                      +
                    </button>

                    {pickerOpen ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="h-10 rounded-xl border px-3 text-sm"
                          value={reportIdToSend}
                          onChange={(e) => setReportIdToSend(e.target.value)}
                        >
                          {reports.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.date}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className={cn(
                            "h-10 rounded-xl px-3 text-sm font-medium",
                            !reportIdToSend || sending
                              ? "cursor-not-allowed bg-gray-200 text-gray-500"
                              : "bg-black text-white"
                          )}
                          disabled={!reportIdToSend || sending}
                          onClick={() => sendMessage({ reportId: reportIdToSend })}
                        >
                          ส่งรายงาน
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        กด <span className="font-semibold">+</span> เพื่อแนบ Daily Report Preview
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className={cn(
                      "h-10 rounded-xl px-4 text-sm font-medium",
                      sending || (!text.trim() && !reportIdToSend)
                        ? "cursor-not-allowed bg-gray-200 text-gray-500"
                        : "bg-black text-white"
                    )}
                    disabled={sending || (!text.trim() && !reportIdToSend)}
                    onClick={() => sendMessage()}
                  >
                    {sending ? "กำลังส่ง..." : "Send"}
                  </button>
                </div>

                <div className="mt-2 text-[11px] text-gray-500">
                  ส่งเร็ว: กด <span className="font-medium">Ctrl/⌘ + Enter</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="font-semibold">สมาชิกในกลุ่ม</div>
              <div className="mt-2 space-y-2">
                {groupMembers.slice(0, 12).map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.name?.trim() ? m.name : m.email}</div>
                      <div className="truncate text-xs text-gray-500">{m.email}</div>
                    </div>
                  </div>
                ))}
                {groupMembers.length > 12 ? <div className="text-xs text-gray-500">และอีก {groupMembers.length - 12} คน…</div> : null}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="font-semibold">หมายเหตุ</div>
              <div className="mt-2 text-sm text-gray-700">
                ตอนนี้แก้ให้ “ส่งข้อความ / add สมาชิก / แนบรายงานแล้วไม่พัง” ก่อน
              </div>
              <div className="mt-2 text-xs text-gray-500">
                ระบบแจ้งเตือนเด้งจริง (PWA/Push) = งาน “ต้องทำต่อ” หลังจากชุดนี้ผ่าน
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
