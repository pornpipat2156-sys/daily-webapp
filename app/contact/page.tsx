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
    <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6 dark:border-slate-800/80 dark:bg-slate-950/72 dark:shadow-[0_20px_50px_rgba(0,0,0,0.34)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        {badge ? (
          <span className="shrink-0 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300">
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
      ? "border border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
      : tone === "pink"
      ? "border border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
      : tone === "amber"
      ? "border border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
      : tone === "violet"
      ? "border border-violet-200/70 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300"
      : "border border-blue-200/70 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300";

  return (
    <div className={cn("rounded-[22px] px-4 py-3", toneClass)}>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-bold">{value}</div>
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

  const [selectedToAdd, setSelectedToAdd] = useState<Record<string, boolean>>(
    {}
  );
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
  const [mentionAnchor, setMentionAnchor] = useState<{
    start: number;
    end: number;
  } | null>(null);

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

  async function reloadMessages(opts?: {
    keepBottom?: boolean;
    behavior?: ScrollBehavior;
  }) {
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
        const memberRows = await jget<any>(
          `/api/chat/members?projectId=${encodeURIComponent(projectId)}`
        );

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

        if (isSuperAdmin) {
          const allowRows = await jget<AllowUserRow[]>(
            `/api/allow-email?projectId=${encodeURIComponent(projectId)}`
          );
          setAllowUsers(allowRows);
        } else {
          setAllowUsers([]);
        }

        setSelectedToAdd({});
        setMemberQuery("");
        setAddQuery("");
        setShowAllMembers(false);
      } catch (e) {
        console.error(e);
        alert("โหลดรายชื่อสมาชิกไม่สำเร็จ: " + String((e as any)?.message || e));
      }
    })();
  }, [projectId, isSuperAdmin]);

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
        alert(
          "โหลดรายการ Daily Report ไม่สำเร็จ: " +
            String((e as any)?.message || e)
        );
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
        (m.name ?? m.email).toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
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
        (u.name ?? u.email).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
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
    const memberRows = await jget<any>(
      `/api/chat/members?projectId=${encodeURIComponent(projectId)}`
    );

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
          (m.name ?? m.email).toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
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
    window.open(
      `/daily-report/preview?reportId=${encodeURIComponent(reportId)}`,
      "_blank"
    );
  }

  const canPickProject = projects.length > 0;

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
      ? "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
      : realtimeState === "connecting"
      ? "border border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300"
      : realtimeState === "error"
      ? "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
      : "border border-slate-200/80 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  const sendDisabled = sending || (!text.trim() && !(pickerOpen && reportIdToSend));
  const currentProjectName =
    projects.find((p) => p.id === projectId)?.projectName ?? "-";

  const inputClass =
    "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-500 dark:focus:ring-blue-900/50";

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 lg:px-6">
        <div className="rounded-[26px] border border-slate-200/80 bg-white/90 px-5 py-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
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
      <div className="mb-5 rounded-[30px] border border-slate-200/70 bg-gradient-to-br from-blue-100/80 via-cyan-50 to-violet-100/80 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.15)] sm:p-6 dark:border-slate-800/70 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-400">
              Contact
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              ห้องแชทสำหรับโครงการ
            </h1>
            <div className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              สนทนาและแลกเปลี่ยนข้อมูลกับทีมงานโครงการ
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold shadow-sm",
                realtimeTone
              )}
            >
              {realtimeText}
            </span>
            <span className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
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
                className={inputClass}
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

              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {isSuperAdmin
                  ? "Superadmin สามารถเลือกได้ทุกโครงการ"
                  : "เลือกได้เฉพาะโครงการที่บัญชีนี้เป็นสมาชิกอยู่"}
              </div>
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
                    className={inputClass}
                    placeholder="ค้นหาชื่อหรืออีเมล..."
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                  />
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                    ยังไม่มีสมาชิก
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleMembers.map((m) => (
                      <div
                        key={m.memberId}
                        className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                            {m.name || m.email}
                          </div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {m.email} • {m.role}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeMember(m.memberId)}
                          disabled={togglingMemberId === m.memberId}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/20"
                        >
                          {togglingMemberId === m.memberId ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    ))}

                    {!showAllMembers && filteredMembers.length > PAGE_SIZE ? (
                      <button
                        type="button"
                        onClick={() => setShowAllMembers(true)}
                        className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        ดูทั้งหมด ({filteredMembers.length})
                      </button>
                    ) : null}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="เพิ่มสมาชิกเข้ากลุ่ม"
                subtitle="ค้นหาและเลือกสมาชิกที่อนุญาตให้เข้าร่วมโครงการนี้"
                badge="Add"
              >
                <div className="mb-4">
                  <FieldLabel>ค้นหาสมาชิกที่จะเพิ่ม</FieldLabel>
                  <input
                    className={inputClass}
                    placeholder="ค้นหาชื่อหรืออีเมล..."
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                  />
                </div>

                {visibleAddable.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                    ไม่มีสมาชิกที่สามารถเพิ่มได้
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleAddable.map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/70 px-4 py-3 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-2 focus:ring-blue-400 dark:border-slate-600 dark:bg-slate-950 dark:text-blue-400"
                          checked={Boolean(selectedToAdd[u.id])}
                          onChange={(e) =>
                            setSelectedToAdd((prev) => ({
                              ...prev,
                              [u.id]: e.target.checked,
                            }))
                          }
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                            {u.name || u.email}
                          </div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {u.email} • {u.role}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={addMembersToGroup}
                  disabled={adding || selectedAddIds.length === 0}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-bold text-white transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  {adding ? "กำลังเพิ่มสมาชิก..." : `เพิ่มสมาชิก (${selectedAddIds.length})`}
                </button>
              </SectionCard>
            </>
          ) : null}
        </div>

        <SectionCard
          title="Project Group Chat"
          subtitle={`โครงการ: ${currentProjectName}`}
          badge="Chat"
        >
          <div
            ref={listRef}
            className="mb-4 max-h-[560px] overflow-y-auto rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-[#081225]"
          >
            {loadingMessages ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                กำลังโหลดข้อความ...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                ยังไม่มีข้อความ
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const mine = msg.author.id === meId;
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-[22px] px-4 py-3 shadow-sm",
                          mine
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "border border-slate-200/80 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
                        )}
                      >
                        <div
                          className={cn(
                            "mb-1 text-[11px] font-bold uppercase tracking-[0.14em]",
                            mine
                              ? "text-white/70 dark:text-slate-500"
                              : "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {msg.author.name || msg.author.email}
                        </div>

                        {msg.text ? (
                          <div className="whitespace-pre-wrap break-words text-sm leading-6">
                            {msg.text}
                          </div>
                        ) : null}

                        {msg.reportId ? (
                          <button
                            type="button"
                            onClick={() => openReport(msg.reportId!)}
                              className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold leading-none text-slate-900 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                          >
                            เปิด Daily Report
                          </button>
                        ) : null}

                        <div
                          className={cn(
                            "mt-2 text-[11px]",
                            mine
                              ? "text-white/70 dark:text-slate-500"
                              : "text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {fmtDateTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative">
            <FieldLabel>ข้อความ</FieldLabel>

            <div className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200 dark:border-slate-700 dark:bg-[#0f1d36] dark:focus-within:border-blue-500 dark:focus-within:ring-blue-900/50">
              <textarea
                ref={inputRef}
                className="min-h-[120px] w-full resize-y rounded-[22px] border-0 bg-transparent px-4 py-3 text-sm leading-6 text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="พิมพ์ข้อความ... ใช้ @ เพื่อ mention สมาชิก"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
              />
            </div>

            {mentionOpen && mentionCandidates.length > 0 ? (
              <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-full max-w-md rounded-[22px] border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                {mentionCandidates.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => insertMention(u)}
                    className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {u.name || u.email}
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {u.email} • {u.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                {pickerOpen ? "ปิดการแนบ Report" : "แนบ Daily Report"}
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                sendMessage({
                  reportId: pickerOpen ? reportIdToSend || null : null,
                })
              }
              disabled={sendDisabled}
              className="inline-flex h-11 min-w-[138px] items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-bold text-white transition hover:translate-y-[-1px] hover:bg-slate-800 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              {sending ? "กำลังส่ง..." : "ส่งข้อความ"}
            </button>
          </div>

          {pickerOpen ? (
            <div className="mt-4 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
              <FieldLabel>เลือก Daily Report</FieldLabel>
              {reports.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  ยังไม่มี Daily Report ให้แนบในโครงการนี้
                </div>
              ) : (
                <select
                  className={inputClass}
                  value={reportIdToSend}
                  onChange={(e) => setReportIdToSend(e.target.value)}
                >
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.date}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}
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
          <div className="rounded-[26px] border border-slate-200/80 bg-white/90 px-5 py-6 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
            กำลังโหลด...
          </div>
        </div>
      }
    >
      <ContactPageInner />
    </Suspense>
  );
}