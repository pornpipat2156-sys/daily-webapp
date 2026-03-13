"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { getChatRealtimeClient } from "@/lib/realtime-browser";

type ProjectRow = {
  id: string;
  projectName: string;
};

type AllowUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN" | string;
};

type GroupMemberRow = {
  memberId: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
};

type ChatMessage = {
  id: string;
  projectId: string;
  author: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  text: string | null;
  createdAt: string;
  reportId: string | null;
  mentionUserIds: string[];
};

type DailyReportRow = {
  id: string;
  date: string;
};

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

function normEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

function mergeChatMessages(prev: ChatMessage[], next: ChatMessage[]) {
  const map = new Map<string, ChatMessage>();
  for (const item of prev) map.set(item.id, item);
  for (const item of next) map.set(item.id, item);

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function roleTone(role?: string) {
  if (role === "SUPERADMIN") {
    return "bg-[rgba(239,127,150,0.14)] text-rose-700 dark:text-rose-300";
  }
  if (role === "ADMIN") {
    return "bg-[rgba(154,135,245,0.16)] text-violet-700 dark:text-violet-300";
  }
  return "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300";
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

function StatChip({
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

function ContactPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  const role = (session as any)?.user?.role as string | undefined;
  const meId = (session as any)?.user?.id as string | undefined;

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectId, setProjectId] = useState("");

  const [allowUsers, setAllowUsers] = useState<AllowUserRow[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMemberRow[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [showAllMembers, setShowAllMembers] = useState(false);

  const PAGE_SIZE = 20;

  const [selectedToAdd, setSelectedToAdd] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [reports, setReports] = useState<DailyReportRow[]>([]);
  const [reportIdToSend, setReportIdToSend] = useState("");

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchor, setMentionAnchor] = useState<{ start: number; end: number } | null>(null);

  const [realtimeState, setRealtimeState] = useState<
    "disabled" | "connecting" | "connected" | "error"
  >("disabled");

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isSuperAdmin = role === "SUPERADMIN";
  const queryProjectId = searchParams.get("projectId") || "";

  async function jget<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
  }

  async function jpost<T>(url: string, body: any): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
  }

  async function jdel<T>(url: string): Promise<T> {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
  }

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior,
      });
    });
  }

  async function reloadMessages(opts?: { keepBottom?: boolean; behavior?: ScrollBehavior }) {
    if (!projectId) return;
    const rows = await jget<ChatMessage[]>(
      `/api/chat/messages?projectId=${encodeURIComponent(projectId)}`
    );
    setMessages(rows);

    if (opts?.keepBottom) {
      scrollToBottom(opts.behavior ?? "auto");
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      const rows = await jget<ProjectRow[]>("/api/projects?scope=chat");
      setProjects(rows);

      const hasQueryProject = rows.some((p) => p.id === queryProjectId);
      if (hasQueryProject) {
        setProjectId(queryProjectId);
        return;
      }

      if (!projectId && rows.length > 0) {
        setProjectId(rows[0].id);
      }
    })().catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, queryProjectId]);

  useEffect(() => {
    if (!projectId) return;

    (async () => {
      try {
        const [allowRows, memberRows] = await Promise.all([
          jget<AllowUserRow[]>(`/api/allow-email?projectId=${encodeURIComponent(projectId)}`),
          jget<any>(`/api/chat/members?projectId=${encodeURIComponent(projectId)}`),
        ]);

        setAllowUsers(allowRows);

        const list = Array.isArray(memberRows)
          ? memberRows
          : Array.isArray(memberRows?.members)
          ? memberRows.members
          : [];

        const normalized: GroupMemberRow[] = list.map((m: any) => ({
          memberId: String(m.memberId ?? m.id ?? ""),
          userId: String(m.userId ?? m.id ?? ""),
          email: String(m.email ?? ""),
          name: m.name ?? null,
          role: String(m.role ?? "USER"),
          isActive: Boolean(m.isActive ?? true),
        }));

        setGroupMembers(normalized);
        setSelectedToAdd({});
        setMemberQuery("");
        setAddQuery("");
        setShowAllMembers(false);
      } catch (e) {
        console.error(e);
        alert("โหลดรายชื่อสมาชิกไม่สำเร็จ: " + String((e as any)?.message || e));
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    setLoadingMessages(true);
    reloadMessages({ keepBottom: true, behavior: "auto" })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => setLoadingMessages(false));
  }, [projectId]);

  useEffect(() => {
    if (!pickerOpen || !projectId) return;

    (async () => {
      try {
        const raw = await jget<any>(
          `/api/daily-reports?projectId=${encodeURIComponent(projectId)}&mode=picker`
        );

        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.reports)
          ? raw.reports
          : Array.isArray(raw?.rows)
          ? raw.rows
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        const cleaned: DailyReportRow[] = list
          .map((x: any) => ({
            id: String(x?.id ?? ""),
            date: String(x?.date ?? ""),
          }))
          .filter((x: DailyReportRow) => x.id);

        setReports(cleaned);
        setReportIdToSend(cleaned[0]?.id ?? "");
      } catch (e) {
        console.error(e);
        setReports([]);
        setReportIdToSend("");
        alert("โหลดรายการ Daily Report ไม่สำเร็จ: " + String((e as any)?.message || e));
      }
    })();
  }, [pickerOpen, projectId]);

  useEffect(() => {
    if (!projectId) return;

    const supabase = getChatRealtimeClient();
    if (!supabase) {
      setRealtimeState("disabled");
      return;
    }

    setRealtimeState("connecting");

    const channel = supabase
      .channel(`chat:project:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ChatMessage",
          filter: `projectId=eq.${projectId}`,
        },
        async () => {
          try {
            await reloadMessages({ keepBottom: true, behavior: "smooth" });
          } catch (e) {
            console.error(e);
          }
        }
      )
      .subscribe(async (subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          setRealtimeState("connected");
          try {
            await reloadMessages({ keepBottom: true, behavior: "auto" });
          } catch (e) {
            console.error(e);
          }
          return;
        }

        if (
          subStatus === "CHANNEL_ERROR" ||
          subStatus === "TIMED_OUT" ||
          subStatus === "CLOSED"
        ) {
          setRealtimeState("error");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  const memberEmailSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of groupMembers) s.add(normEmail(m.email));
    return s;
  }, [groupMembers]);

  const addableUsers = useMemo(() => {
    return allowUsers.filter((u) => !memberEmailSet.has(normEmail(u.email)));
  }, [allowUsers, memberEmailSet]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const base = groupMembers.filter((m) => m.isActive !== false);

    if (!q) return base;
    return base.filter(
      (m) =>
        (m.name ?? m.email).toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [groupMembers, memberQuery]);

  const visibleMembers = useMemo(() => {
    if (showAllMembers) return filteredMembers;
    return filteredMembers.slice(0, PAGE_SIZE);
  }, [filteredMembers, showAllMembers]);

  const filteredAddable = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (!q) return addableUsers;

    return addableUsers.filter(
      (u) =>
        (u.name ?? u.email).toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [addableUsers, addQuery]);

  const visibleAddable = useMemo(() => {
    return filteredAddable.slice(0, 50);
  }, [filteredAddable]);

  const selectedAddIds = useMemo(
    () =>
      Object.entries(selectedToAdd)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [selectedToAdd]
  );

  async function reloadMembersOnly() {
    const memberRows = await jget<any>(`/api/chat/members?projectId=${encodeURIComponent(projectId)}`);

    const list = Array.isArray(memberRows)
      ? memberRows
      : Array.isArray(memberRows?.members)
      ? memberRows.members
      : [];

    const normalized: GroupMemberRow[] = list.map((m: any) => ({
      memberId: String(m.memberId ?? m.id ?? ""),
      userId: String(m.userId ?? m.id ?? ""),
      email: String(m.email ?? ""),
      name: m.name ?? null,
      role: String(m.role ?? "USER"),
      isActive: Boolean(m.isActive ?? true),
    }));

    setGroupMembers(normalized);
  }

  async function addMembersToGroup() {
    if (!projectId || selectedAddIds.length === 0) return;

    setAdding(true);
    try {
      for (const userId of selectedAddIds) {
        await jpost(`/api/chat/members`, { projectId, userId });
      }

      await reloadMembersOnly();
      setSelectedToAdd({});
      alert("เพิ่มสมาชิกสำเร็จ");
    } catch (e) {
      console.error(e);
      alert("เพิ่มสมาชิกไม่สำเร็จ: " + String((e as any)?.message || e));
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!memberId) return;
    if (!confirm("ต้องการ Remove สมาชิกคนนี้ออกจากกลุ่มใช่ไหม?")) return;

    setTogglingMemberId(memberId);
    try {
      await jdel(`/api/chat/members/${encodeURIComponent(memberId)}`);
      setGroupMembers((prev) => prev.filter((m) => m.memberId !== memberId));
    } catch (e) {
      console.error(e);
      alert("Remove ไม่สำเร็จ: " + String((e as any)?.message || e));
    } finally {
      setTogglingMemberId(null);
    }
  }

  const mentionSource: AllowUserRow[] = useMemo(() => {
    return groupMembers
      .filter((m) => m.isActive !== false)
      .map((m) => ({
        id: m.userId,
        email: m.email,
        name: m.name,
        role: m.role,
      }));
  }, [groupMembers]);

  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return mentionSource.slice(0, 8);

    return mentionSource
      .filter(
        (m) =>
          (m.name ?? m.email).toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [mentionSource, mentionQuery]);

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

  async function sendMessage(opts?: { reportId?: string | null }) {
    if (!projectId) return;

    const hasText = text.trim().length > 0;
    const repId = opts?.reportId ?? null;

    if (!hasText && !repId) return;

    setSending(true);
    try {
      const created = await jpost<ChatMessage>("/api/chat/messages", {
        projectId,
        text: hasText ? text.trim() : null,
        reportId: repId,
      });

      setMessages((prev) => mergeChatMessages(prev, [created]));
      setText("");
      setMentionOpen(false);
      setMentionQuery("");
      setMentionAnchor(null);
      setPickerOpen(false);
      scrollToBottom("smooth");
    } catch (e) {
      console.error(e);
      alert("ส่งข้อความไม่สำเร็จ: " + String((e as any)?.message || e));
    } finally {
      setSending(false);
    }
  }

  function openReport(reportId: string) {
    window.open(`/daily-report/preview?reportId=${encodeURIComponent(reportId)}`, "_blank");
  }

  const canPickProject = isSuperAdmin;

  const realtimeText =
    realtimeState === "connected"
      ? "Realtime: Connected"
      : realtimeState === "connecting"
      ? "Realtime: Connecting..."
      : realtimeState === "error"
      ? "Realtime: Reconnecting..."
      : "Realtime: Disabled";

  const realtimeTone =
    realtimeState === "connected"
      ? "status-success"
      : realtimeState === "connecting"
      ? "status-info"
      : realtimeState === "error"
      ? "status-warning"
      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300";

  const sendDisabled = sending || (!text.trim() && !(pickerOpen && reportIdToSend));
  const currentProjectName = projects.find((p) => p.id === projectId)?.projectName ?? "-";

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 lg:px-6">
        <div className="soft-card rounded-[26px] px-5 py-6 text-sm text-slate-500 dark:text-slate-300">
          กำลังโหลด...
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 lg:px-6">
        <div className="rounded-[26px] border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          กรุณาเข้าสู่ระบบก่อนใช้งาน
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-8 sm:px-4 lg:px-6">
      <div className="mb-5 rounded-[30px] bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.14),rgba(247,199,217,0.16))] p-5 shadow-[0_14px_38px_rgba(148,163,184,0.10)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Contact
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              ห้องแชทสำหรับโครงการ
            </h1>
            <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              สนทนาและแลกเปลี่ยนข้อมูลกับทีมงานโครงการ
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-3 py-1.5 text-xs font-bold shadow-sm", realtimeTone)}>
              {realtimeText}
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900/60 dark:text-slate-200">
              {currentProjectName}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionCard
            title="ตั้งค่าห้องแชท"
            subtitle="เลือกโครงการที่จะดูหรือสนทนา"
            badge="Project"
          >
            <div>
              <FieldLabel>โครงการ</FieldLabel>
              <select
                className="soft-input h-12 w-full px-4 text-sm text-slate-700 hover:bg-white disabled:opacity-50 dark:text-slate-100"
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
              {!isSuperAdmin ? (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  บัญชีนี้เปลี่ยนโครงการไม่ได้ ระบบเลือกตามสิทธิ์ที่ใช้งานได้
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatChip label="สมาชิกในกลุ่ม" value={groupMembers.length} tone="mint" />
              <StatChip label="ข้อความ" value={messages.length} tone="blue" />
            </div>
          </SectionCard>

          {isSuperAdmin ? (
            <>
              <SectionCard
                title="สมาชิกในกลุ่ม"
                subtitle="ค้นหาและจัดการสมาชิกที่อยู่ในห้องแชทปัจจุบัน"
                badge="Members"
              >
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <StatChip label="Active" value={groupMembers.length} tone="blue" />
                  <StatChip label="Filtered" value={filteredMembers.length} tone="violet" />
                </div>

                <div className="mb-4">
                  <FieldLabel>ค้นหาสมาชิก</FieldLabel>
                  <input
                    className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                    placeholder="ค้นหาชื่อหรืออีเมล..."
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                  />
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-border bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                    ยังไม่มีสมาชิก
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleMembers.map((m) => {
                      const label = m.name?.trim() ? m.name : m.email;
                      const busy = togglingMemberId === m.memberId;

                      return (
                        <div
                          key={m.memberId}
                          className="rounded-[22px] border border-border/80 bg-white/85 p-4 shadow-[0_6px_18px_rgba(148,163,184,0.08)] dark:bg-slate-900/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                {label}
                              </div>
                              <div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                                {m.email}
                              </div>
                              <div className="mt-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[11px] font-bold",
                                    roleTone(m.role)
                                  )}
                                >
                                  {m.role}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeMember(m.memberId)}
                              disabled={busy}
                              title="Remove member"
                              className="soft-btn shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                            >
                              {busy ? "กำลังทำ..." : "Remove"}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredMembers.length > PAGE_SIZE ? (
                      <button
                        type="button"
                        onClick={() => setShowAllMembers((v) => !v)}
                        className="soft-btn w-full rounded-[18px] border border-border/80 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-white dark:bg-slate-900/50 dark:text-slate-200"
                      >
                        {showAllMembers
                          ? "แสดงน้อยลง"
                          : `แสดงทั้งหมด (${filteredMembers.length})`}
                      </button>
                    ) : null}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="เพิ่มผู้เข้าร่วมกลุ่ม"
                subtitle="แสดงเฉพาะคนที่ยังไม่เป็นสมาชิก"
                badge="Add Members"
              >
                <div className="mb-4 flex flex-col gap-3">
                  <button
                    type="button"
                    className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white disabled:opacity-50 dark:text-slate-100"
                    onClick={addMembersToGroup}
                    disabled={adding || selectedAddIds.length === 0}
                  >
                    {adding ? "กำลังเพิ่ม..." : `Add (${selectedAddIds.length})`}
                  </button>

                  <div>
                    <FieldLabel>ค้นหารายชื่อที่จะเพิ่ม</FieldLabel>
                    <input
                      className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                      placeholder="ค้นหาชื่อหรืออีเมล..."
                      value={addQuery}
                      onChange={(e) => setAddQuery(e.target.value)}
                    />
                  </div>
                </div>

                {filteredAddable.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-border bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                    ไม่มีรายชื่อที่เพิ่มได้ (ทุกคนเป็นสมาชิกแล้ว)
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleAddable.map((u) => {
                      const label = u.name?.trim() ? u.name : u.email;
                      const checked = Boolean(selectedToAdd[u.id]);

                      return (
                        <label
                          key={u.id}
                          className="flex cursor-pointer items-start gap-3 rounded-[22px] border border-border/80 bg-white/85 p-4 shadow-[0_6px_18px_rgba(148,163,184,0.08)] dark:bg-slate-900/50"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedToAdd((p) => ({
                                ...p,
                                [u.id]: e.target.checked,
                              }))
                            }
                          />

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                              {label}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                              {u.email}
                            </div>
                            <div className="mt-2">
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-bold",
                                  roleTone(u.role)
                                )}
                              >
                                {u.role}
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })}

                    {filteredAddable.length > 50 ? (
                      <div className="rounded-[18px] bg-[rgba(243,190,114,0.14)] px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                        แสดง 50 รายชื่อแรก (ใช้ช่องค้นหาเพื่อเจาะจง)
                      </div>
                    ) : null}
                  </div>
                )}
              </SectionCard>
            </>
          ) : null}
        </div>

        <SectionCard
          title="ห้องแชท"
          subtitle={`โครงการ: ${currentProjectName}`}
          badge="Chat"
        >
          <div className="grid gap-4">
            <div
              ref={listRef}
              className="soft-scroll h-[52dvh] min-h-[360px] overflow-y-auto rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,255,0.92))] p-3 sm:p-4 dark:bg-[linear-gradient(180deg,rgba(17,28,44,0.85),rgba(22,33,49,0.92))]"
            >
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-border bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
                  กำลังโหลดข้อความ...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-border bg-white/60 px-4 py-8 text-sm text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
                  ยังไม่มีข้อความ
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const mine = msg.author.id === meId;
                    const label = msg.author.name?.trim() ? msg.author.name : msg.author.email;

                    return (
                      <div
                        key={msg.id}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[92%] rounded-[24px] px-4 py-3 shadow-[0_8px_22px_rgba(148,163,184,0.10)] sm:max-w-[78%]",
                            mine
                              ? "bg-[linear-gradient(135deg,rgba(124,156,245,0.18),rgba(121,217,199,0.16))] text-slate-800 dark:text-slate-100"
                              : "border border-border/80 bg-white/88 text-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold">{label}</span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-bold",
                                roleTone(msg.author.role)
                              )}
                            >
                              {msg.author.role}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {fmtDateTime(msg.createdAt)}
                            </span>
                          </div>

                          {msg.text ? (
                            <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                              {msg.text}
                            </div>
                          ) : null}

                          {msg.reportId ? (
                            <button
                              type="button"
                              onClick={() => openReport(msg.reportId!)}
                              className="soft-btn mt-3 inline-flex items-center rounded-full border border-primary/20 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:bg-slate-800/80 dark:text-slate-100"
                            >
                              เปิด Daily Report Preview
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(251,252,255,0.94))] p-4 shadow-[0_10px_26px_rgba(148,163,184,0.08)] dark:bg-[linear-gradient(180deg,rgba(17,28,44,0.9),rgba(22,33,49,0.94))]">
              <div className="relative">
                <FieldLabel>ข้อความ</FieldLabel>
                <textarea
                  ref={inputRef}
                  className="soft-input min-h-[132px] w-full px-4 py-3 text-sm leading-6 text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                  placeholder="พิมพ์ข้อความ... ใช้ @ เพื่อ mention สมาชิก"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                />

                {mentionOpen && mentionCandidates.length > 0 ? (
                  <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-full max-w-md overflow-hidden rounded-[22px] border border-border bg-white shadow-[0_18px_40px_rgba(148,163,184,0.18)] dark:bg-slate-900">
                    {mentionCandidates.map((u, idx) => {
                      const label = u.name?.trim() ? u.name : u.email;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className={cn(
                            "block w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800",
                            idx !== mentionCandidates.length - 1
                              ? "border-b border-border/70"
                              : ""
                          )}
                          onClick={() => insertMention(u)}
                        >
                          <div className="font-bold text-slate-800 dark:text-slate-100">{label}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {u.email}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.14),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white dark:text-slate-100"
                      onClick={() => setPickerOpen((v) => !v)}
                    >
                      {pickerOpen ? "ซ่อนรายการ Daily Report" : "แนบ Daily Report"}
                    </button>

                    {pickerOpen ? (
                      <select
                        className="soft-input h-11 min-w-[220px] px-4 text-sm text-slate-700 dark:text-slate-100"
                        value={reportIdToSend}
                        onChange={(e) => setReportIdToSend(e.target.value)}
                      >
                        {reports.length === 0 ? (
                          <option value="">ไม่มีรายการ</option>
                        ) : (
                          reports.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.date}
                            </option>
                          ))
                        )}
                      </select>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="soft-btn inline-flex min-h-12 items-center justify-center rounded-[20px] border border-primary/25 bg-[linear-gradient(135deg,rgba(124,156,245,0.96),rgba(121,217,199,0.96))] px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(124,156,245,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => sendMessage({ reportId: pickerOpen ? reportIdToSend : null })}
                    disabled={sendDisabled}
                  >
                    {sending ? "กำลังส่ง..." : "ส่งข้อความ"}
                  </button>
                </div>

                {pickerOpen && reports.length === 0 ? (
                  <div className="rounded-[18px] bg-[rgba(243,190,114,0.14)] px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    ยังไม่มี Daily Report ให้แนบในโครงการนี้
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 lg:px-6">
          <div className="soft-card rounded-[26px] px-5 py-6 text-sm text-slate-500 dark:text-slate-300">
            กำลังโหลด...
          </div>
        </div>
      }
    >
      <ContactPageInner />
    </Suspense>
  );
}