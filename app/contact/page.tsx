"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type ProjectRow = { id: string; projectName: string };

type AllowUserRow = {
  id: string; // userId
  email: string;
  name: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN" | string;
};

type GroupMemberRow = {
  memberId: string; // ChatGroupMember.id
  userId: string; // User.id
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
};

type ChatMessage = {
  id: string;
  projectId: string;
  author: { id: string; email: string; name: string | null; role: string };
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function ContactPage() {
  const { data: session, status } = useSession();
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

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  const isSuperAdmin = role === "SUPERADMIN";

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

  async function getServiceWorkerRegistration() {
    if (typeof window === "undefined") return null;
    if (!("serviceWorker" in navigator)) return null;

    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) return reg;

    return navigator.serviceWorker.ready;
  }

  async function refreshPushStatus() {
    if (typeof window === "undefined") return;
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    if (!supported) {
      setPushSupported(false);
      setPushSubscribed(false);
      setPushPermission("unsupported");
      return;
    }

    setPushSupported(true);
    setPushPermission(Notification.permission);

    try {
      const reg = await getServiceWorkerRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    } catch {
      setPushSubscribed(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;

    (async () => {
      const rows = await jget<ProjectRow[]>("/api/projects?scope=chat");
      setProjects(rows);
      if (!projectId && rows.length) setProjectId(rows[0].id);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    refreshPushStatus().catch(console.error);
  }, [status]);

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
    (async () => {
      const rows = await jget<ChatMessage[]>(`/api/chat/messages?projectId=${encodeURIComponent(projectId)}`);
      setMessages(rows);
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "auto" });
      }, 50);
    })()
      .catch(console.error)
      .finally(() => setLoadingMessages(false));
  }, [projectId]);

  useEffect(() => {
    if (!pickerOpen || !projectId) return;

    (async () => {
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
    })().catch((e) => {
      console.error(e);
      setReports([]);
      setReportIdToSend("");
      alert("โหลดรายการ Daily Report ไม่สำเร็จ: " + String((e as any)?.message || e));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen, projectId]);

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
    () => Object.entries(selectedToAdd).filter(([, v]) => v).map(([k]) => k),
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

  async function enablePushNotifications() {
    if (!pushSupported) {
      alert("อุปกรณ์/เบราว์เซอร์นี้ยังไม่รองรับ Push Notification");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    if (!vapidPublicKey) {
      alert("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_VAPID_PUBLIC_KEY");
      return;
    }

    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        alert("คุณยังไม่ได้อนุญาตการแจ้งเตือน");
        return;
      }

      const reg = await getServiceWorkerRegistration();
      if (!reg) {
        alert("ไม่พบ Service Worker registration");
        return;
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      await jpost("/api/push/subscribe", {
        subscription: sub.toJSON(),
      });

      setPushSubscribed(true);
      alert("เปิดการแจ้งเตือนสำเร็จ");
    } catch (e) {
      console.error(e);
      alert("เปิดการแจ้งเตือนไม่สำเร็จ: " + String((e as any)?.message || e));
    } finally {
      setPushBusy(false);
      refreshPushStatus().catch(console.error);
    }
  }

  async function disablePushNotifications() {
    setPushBusy(true);
    try {
      const reg = await getServiceWorkerRegistration();
      const sub = await reg?.pushManager.getSubscription();

      if (sub) {
        await jpost("/api/push/unsubscribe", {
          endpoint: sub.endpoint,
        });
        await sub.unsubscribe();
      }

      setPushSubscribed(false);
      alert("ปิดการแจ้งเตือนสำเร็จ");
    } catch (e) {
      console.error(e);
      alert("ปิดการแจ้งเตือนไม่สำเร็จ: " + String((e as any)?.message || e));
    } finally {
      setPushBusy(false);
      refreshPushStatus().catch(console.error);
    }
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

      setMessages((prev) => [...prev, created]);
      setText("");
      setPickerOpen(false);

      setTimeout(() => {
        listRef.current?.scrollTo({
          top: listRef.current?.scrollHeight ?? 0,
          behavior: "smooth",
        });
      }, 30);
    } catch (e) {
      console.error(e);
      alert("ส่งข้อความไม่สำเร็จ: " + String((e as any)?.message || e));
    } finally {
      setSending(false);
    }
  }

  const canPickProject = isSuperAdmin;

  function openReport(reportId: string) {
    window.open(`/daily-report/preview?reportId=${encodeURIComponent(reportId)}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 rounded-2xl border bg-white p-4">
        <div className="text-xl font-semibold">Contact (Project Group Chat)</div>
        <div className="mt-1 text-sm text-gray-600">
          เก็บ log การพูดคุย + แนบ Daily Report Preview ลงกลุ่มได้
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-medium">โครงการ</label>
            <select
              className="h-11 w-full rounded-xl border px-3"
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
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium">Push Notification</div>
            {!pushSupported ? (
              <div className="mt-1 text-xs text-gray-500">
                อุปกรณ์/เบราว์เซอร์นี้ยังไม่รองรับ
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-500">
                สถานะ:{" "}
                {pushSubscribed
                  ? "เปิดอยู่"
                  : pushPermission === "denied"
                    ? "ถูกบล็อกโดยเบราว์เซอร์"
                    : "ยังไม่เปิด"}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  !pushSupported || pushBusy || pushSubscribed
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-black text-white"
                )}
                disabled={!pushSupported || pushBusy || pushSubscribed}
                onClick={enablePushNotifications}
              >
                {pushBusy && !pushSubscribed ? "กำลังเปิด..." : "เปิดการแจ้งเตือน"}
              </button>

              <button
                type="button"
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  !pushSupported || pushBusy || !pushSubscribed
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "border"
                )}
                disabled={!pushSupported || pushBusy || !pushSubscribed}
                onClick={disablePushNotifications}
              >
                {pushBusy && pushSubscribed ? "กำลังปิด..." : "ปิดการแจ้งเตือน"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Member management */}
      {isSuperAdmin ? (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          {/* Current Members */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">สมาชิกในกลุ่ม (Current Members)</div>
                <div className="text-sm text-gray-500">
                  Active: {groupMembers.length} / ทั้งหมด {groupMembers.length}
                </div>
              </div>
            </div>

            <input
              className="mt-3 h-11 w-full rounded-xl border px-3"
              placeholder="ค้นหาสมาชิก..."
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />

            <div className="mt-3 space-y-2">
              {filteredMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed p-3 text-sm text-gray-500">
                  ยังไม่มีสมาชิก
                </div>
              ) : (
                <>
                  {visibleMembers.map((m) => {
                    const label = m.name?.trim() ? m.name : m.email;
                    const busy = togglingMemberId === m.memberId;

                    return (
                      <div
                        key={m.memberId}
                        className="flex items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{label}</div>
                          <div className="truncate text-xs text-gray-500">{m.email}</div>
                        </div>

                        <button
                          type="button"
                          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => removeMember(m.memberId)}
                          disabled={busy}
                          title="Remove member"
                        >
                          {busy ? "กำลังทำ..." : "Remove"}
                        </button>
                      </div>
                    );
                  })}

                  {filteredMembers.length > PAGE_SIZE ? (
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => setShowAllMembers((v) => !v)}
                    >
                      {showAllMembers
                        ? "แสดงน้อยลง"
                        : `แสดงทั้งหมด (${filteredMembers.length})`}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Add Members */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">เพิ่มผู้เข้าร่วมกลุ่ม (Add Members)</div>
                <div className="text-sm text-gray-500">
                  แสดงเฉพาะคนที่ “ยังไม่เป็นสมาชิก”
                </div>
              </div>

              <button
                type="button"
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium",
                  adding || selectedAddIds.length === 0
                    ? "cursor-not-allowed bg-gray-200 text-gray-500"
                    : "bg-black text-white"
                )}
                disabled={adding || selectedAddIds.length === 0}
                onClick={addMembersToGroup}
              >
                {adding ? "กำลังเพิ่ม..." : `Add (${selectedAddIds.length})`}
              </button>
            </div>

            <input
              className="mt-3 h-11 w-full rounded-xl border px-3"
              placeholder="ค้นหารายชื่อที่จะเพิ่ม..."
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
            />

            <div className="mt-3 space-y-2">
              {filteredAddable.length === 0 ? (
                <div className="rounded-xl border border-dashed p-3 text-sm text-gray-500">
                  ไม่มีรายชื่อที่เพิ่มได้ (ทุกคนเป็นสมาชิกแล้ว)
                </div>
              ) : (
                <>
                  {visibleAddable.map((u) => {
                    const label = u.name?.trim() ? u.name : u.email;

                    return (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border p-3"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedToAdd[u.id])}
                          onChange={(e) =>
                            setSelectedToAdd((p) => ({ ...p, [u.id]: e.target.checked }))
                          }
                        />

                        <div className="min-w-0">
                          <div className="truncate font-medium">{label}</div>
                          <div className="truncate text-xs text-gray-500">{u.email}</div>
                        </div>
                      </label>
                    );
                  })}

                  {filteredAddable.length > 50 ? (
                    <div className="text-xs text-gray-500">
                      แสดง 50 รายชื่อแรก (ใช้ช่องค้นหาเพื่อเจาะจง)
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Chat */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3">
          <div className="font-semibold">ห้องแชท</div>
          <div className="text-sm text-gray-500">
            โครงการ: {projects.find((p) => p.id === projectId)?.projectName ?? "-"}
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-[480px] space-y-3 overflow-y-auto rounded-2xl border bg-gray-50 p-3"
        >
          {loadingMessages ? (
            <div className="text-sm text-gray-500">กำลังโหลดข้อความ...</div>
          ) : messages.length === 0 ? (
            <div className="text-sm text-gray-500">ยังไม่มีข้อความ</div>
          ) : (
            messages.map((msg) => {
              const mine = !!meId && msg.author.id === meId;
              const authorLabel = msg.author.name?.trim() ? msg.author.name : msg.author.email;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-2xl border bg-white p-3",
                    mine ? "ml-8" : "mr-8"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{authorLabel}</div>
                    <div className="text-xs text-gray-500">{fmtDateTime(msg.createdAt)}</div>
                  </div>

                  {msg.reportId ? (
                    <div className="mt-2 rounded-xl border bg-gray-50 p-3">
                      <div className="text-sm font-medium">แนบ Daily Report</div>
                      <button
                        type="button"
                        className="mt-2 text-sm text-blue-600 hover:underline"
                        onClick={() => openReport(msg.reportId!)}
                      >
                        เปิดดูรายงาน (Read-only)
                      </button>
                    </div>
                  ) : null}

                  {msg.text ? (
                    <div className="mt-2 whitespace-pre-wrap text-sm">{msg.text}</div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="mt-4">
          {mentionOpen && mentionCandidates.length > 0 ? (
            <div className="mb-2 rounded-2xl border bg-white p-2 shadow-sm">
              <div className="mb-2 text-xs font-medium text-gray-500">Mention</div>
              <div className="space-y-1">
                {mentionCandidates.map((u) => {
                  const label = u.name?.trim() ? u.name : u.email;

                  return (
                    <button
                      key={u.id}
                      type="button"
                      className="block w-full rounded-xl px-3 py-2 text-left hover:bg-gray-50"
                      onClick={() => insertMention(u)}
                    >
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <textarea
            ref={inputRef}
            className="min-h-[110px] w-full rounded-2xl border p-3 outline-none"
            placeholder="พิมพ์ข้อความ... ใช้ @ เพื่อ mention สมาชิกในกลุ่ม"
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
              <button
                type="button"
                className="h-10 w-10 rounded-xl border text-lg hover:bg-gray-50"
                onClick={() => setPickerOpen((v) => !v)}
                title="แนบ Daily Report"
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
                  กด <span className="font-semibold">+</span> เพื่อแนบ Daily Report
                </div>
              )}
            </div>

            <button
              type="button"
              className={cn(
                "h-10 rounded-xl px-4 text-sm font-medium",
                sending || (!text.trim() && !pickerOpen)
                  ? "cursor-not-allowed bg-gray-200 text-gray-500"
                  : "bg-black text-white"
              )}
              disabled={sending || (!text.trim() && !pickerOpen)}
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
  );
}