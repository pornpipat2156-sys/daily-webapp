"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: "MENTION" | "APPROVAL" | "SYSTEM";
  title: string;
  body: string;
  url: string | null;
  sourceKey: string | null;
  groupKey: string | null;
  projectId: string | null;
  readAt: string | null;
  createdAt: string;
  meta: Record<string, unknown> | null;
};

type NotificationResponse = {
  ok: boolean;
  unreadCount: number;
  unreadMentions: number;
  unreadApprovals: number;
  items: NotificationItem[];
};

type Props = {
  onSummaryChange?: (summary: {
    unreadCount: number;
    unreadMentions: number;
    unreadApprovals: number;
  }) => void;
};

type GroupedNotificationItem = NotificationItem & {
  count: number;
  groupedIds: string[];
};

const PUSH_PROMPT_SESSION_KEY = "daily-webapp-push-prompt-dismissed-session-v1";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getProjectName(item: NotificationItem) {
  const projectName =
    item?.meta && typeof item.meta === "object"
      ? String((item.meta as Record<string, unknown>).projectName || "").trim()
      : "";

  return projectName || null;
}

function groupNotifications(items: NotificationItem[]) {
  const grouped: GroupedNotificationItem[] = [];
  const map = new Map<string, number>();

  for (const item of items) {
    const key = item.readAt ? item.id : item.groupKey || item.id;
    const existingIndex = map.get(key);

    if (existingIndex == null) {
      map.set(key, grouped.length);
      grouped.push({
        ...item,
        count: 1,
        groupedIds: [item.id],
      });
      continue;
    }

    const target = grouped[existingIndex];
    target.count += 1;
    target.groupedIds.push(item.id);

    const currentCreated = new Date(item.createdAt).getTime();
    const targetCreated = new Date(target.createdAt).getTime();

    if (currentCreated > targetCreated) {
      grouped[existingIndex] = {
        ...target,
        ...item,
        count: target.count,
        groupedIds: target.groupedIds,
      };
    }
  }

  return grouped;
}

function getTypeIcon(type: NotificationItem["type"]) {
  if (type === "MENTION") return "💬";
  if (type === "APPROVAL") return "✅";
  return "🔔";
}

function getGroupedTitle(item: GroupedNotificationItem) {
  if (item.count <= 1 || item.readAt) return item.title;

  const projectName = getProjectName(item);

  if (item.type === "MENTION") {
    if (projectName) return `${item.count} new mentions in ${projectName}`;
    return `${item.count} new mentions`;
  }

  if (item.type === "APPROVAL") {
    if (projectName) return `${item.count} approval updates in ${projectName}`;
    return `${item.count} new approvals`;
  }

  return `${item.count} new notifications`;
}

function getGroupedBody(item: GroupedNotificationItem) {
  if (item.count <= 1 || item.readAt) return item.body;

  const projectName = getProjectName(item);

  if (item.type === "MENTION") {
    return projectName
      ? `มี mention ใหม่สะสมใน ${projectName} กดเพื่อเปิดแชตโครงการ`
      : "มี mention ใหม่หลายรายการ กดเพื่อเปิดดูรายละเอียด";
  }

  if (item.type === "APPROVAL") {
    return projectName
      ? `มีการอัปเดตสถานะอนุมัติใน ${projectName}`
      : "มีการอัปเดตสถานะอนุมัติหลายรายการ";
  }

  return item.body;
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

function isIosDevice() {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const touchPoints = window.navigator.maxTouchPoints || 0;

  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && touchPoints > 1);
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    nav.standalone === true
  );
}

function supportsPushPrompt() {
  if (typeof window === "undefined") return false;

  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function getBrowserPermissionState(): NotificationPermission | "unsupported" {
  if (!supportsPushPrompt()) return "unsupported";
  return Notification.permission;
}

export default function NotificationBell({ onSummaryChange }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<NotificationResponse>({
    ok: true,
    unreadCount: 0,
    unreadMentions: 0,
    unreadApprovals: 0,
    items: [],
  });

  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);

    try {
      const res = await fetch("/api/notifications?limit=50", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const json = (await res.json()) as NotificationResponse;
      setSummary(json);

      onSummaryChange?.({
        unreadCount: json.unreadCount || 0,
        unreadMentions: json.unreadMentions || 0,
        unreadApprovals: json.unreadApprovals || 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(ids: string[], url?: string | null) {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });

      await load();
      setOpen(false);

      if (url) {
        window.location.href = url;
      }
    } catch (e) {
      console.error(e);
      if (url) window.location.href = url;
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ all: true }),
      });

      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function getServiceWorkerRegistration() {
    if (typeof window === "undefined") return null;
    if (!("serviceWorker" in navigator)) return null;

    const direct = await navigator.serviceWorker.getRegistration("/sw.js");
    if (direct) return direct;

    const anyReg = await navigator.serviceWorker.getRegistration();
    if (anyReg) return anyReg;

    return navigator.serviceWorker.ready;
  }

  async function syncPushStatus() {
    const nextPermission = getBrowserPermissionState();
    setPermissionState(nextPermission);

    if (!supportsPushPrompt()) {
      setPushSubscribed(false);
      return;
    }

    try {
      const reg = await getServiceWorkerRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    } catch (error) {
      console.error("syncPushStatus error:", error);
      setPushSubscribed(false);
    }
  }

  async function subscribeCurrentBrowser() {
    if (!supportsPushPrompt()) {
      throw new Error("unsupported");
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_VAPID_PUBLIC_KEY");
    }

    const registration =
      (await getServiceWorkerRegistration()) || (await navigator.serviceWorker.register("/sw.js"));

    let sub = await registration.pushManager.getSubscription();

    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    setPushSubscribed(true);
  }

  async function disableCurrentBrowserPush() {
    if (!supportsPushPrompt()) {
      setPushMessage("อุปกรณ์นี้ยังไม่รองรับการแจ้งเตือนผ่านเว็บ");
      return;
    }

    setPushBusy(true);
    setPushMessage(null);

    try {
      const reg = await getServiceWorkerRegistration();
      const sub = await reg?.pushManager.getSubscription();

      if (!sub) {
        setPushSubscribed(false);
        setPushMessage("อุปกรณ์นี้ยังไม่ได้เปิดการแจ้งเตือน");
        return;
      }

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });

      await sub.unsubscribe();

      setPushSubscribed(false);
      setPushMessage(
        permissionState === "granted"
          ? "ปิดการแจ้งเตือนสำหรับอุปกรณ์นี้แล้ว"
          : "ปิดการแจ้งเตือนแล้ว"
      );
    } catch (error) {
      console.error("disableCurrentBrowserPush error:", error);
      setPushMessage("ปิดการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setPushBusy(false);
      await syncPushStatus();
    }
  }

  async function handleEnablePush() {
    if (!supportsPushPrompt()) {
      setPermissionState("unsupported");
      setPushMessage("อุปกรณ์นี้ยังไม่รองรับการแจ้งเตือนผ่านเว็บ");
      return;
    }

    if (isIosDevice() && !isStandaloneDisplayMode()) {
      setPushMessage("บน iPhone/iPad ให้ Add to Home Screen แล้วเปิดแอปจากไอคอนก่อน");
      return;
    }

    setPushBusy(true);
    setPushMessage(null);

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== "granted") {
        setPushMessage(
          permission === "denied"
            ? "เบราว์เซอร์บล็อกการแจ้งเตือนแล้ว ต้องไปเปิดใหม่ใน Site Settings"
            : "ยังไม่ได้อนุญาตการแจ้งเตือน"
        );
        return;
      }

      await subscribeCurrentBrowser();

      try {
        sessionStorage.setItem(PUSH_PROMPT_SESSION_KEY, "1");
      } catch {
        // ignore
      }

      setShowPushPrompt(false);
      setPushMessage("เปิดการแจ้งเตือนสำเร็จ");
    } catch (error) {
      console.error("handleEnablePush error:", error);
      setPushMessage(
        error instanceof Error && error.message ? error.message : "ไม่สามารถเปิดการแจ้งเตือนได้"
      );
    } finally {
      setPushBusy(false);
      await syncPushStatus();
    }
  }

  function dismissPromptForSession() {
    setShowPushPrompt(false);
    try {
      sessionStorage.setItem(PUSH_PROMPT_SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }

  function handleBellClick() {
    setOpen((prev) => !prev);
  }

  useEffect(() => {
    load().catch(console.error);

    const id = window.setInterval(() => {
      load().catch(console.error);
    }, 15000);

    function onRefresh() {
      load().catch(console.error);
    }

    function onVisibilityChange() {
      if (!document.hidden) {
        syncPushStatus().catch(console.error);
      }
    }

    window.addEventListener("notifications:refresh", onRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("notifications:refresh", onRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    syncPushStatus().catch(console.error);
  }, []);

  useEffect(() => {
    if (!supportsPushPrompt()) return;

    const permission = getBrowserPermissionState();
    setPermissionState(permission);

    if (permission !== "default") return;

    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(PUSH_PROMPT_SESSION_KEY) === "1";
    } catch {
      dismissed = false;
    }

    if (dismissed) return;

    const timer = window.setTimeout(() => {
      setShowPushPrompt(true);
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!open) return;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowPushPrompt(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const grouped = useMemo(() => groupNotifications(summary.items || []), [summary.items]);
  const isIosWithoutStandalone = isIosDevice() && !isStandaloneDisplayMode();

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={handleBellClick}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          aria-label="Notifications"
          title="Notifications"
        >
          <span className="text-lg">🔔</span>

          {summary.unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow">
              {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
            </span>
          )}
        </button>

        {open && (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/20"
              aria-label="Close notifications"
            />

            <div className="fixed inset-x-3 bottom-3 top-[88px] z-50 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:right-0 sm:mt-3 sm:h-auto sm:max-h-[min(78vh,40rem)] sm:w-[min(92vw,24rem)]">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Notifications</div>
                  <div className="text-xs text-neutral-500">
                    {summary.unreadCount > 99 ? "99+" : summary.unreadCount} unread
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {summary.unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllAsRead()}
                      className="shrink-0 text-xs font-semibold text-rose-500 transition hover:text-rose-600 sm:text-sm"
                    >
                      Mark All
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 sm:hidden"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                <div className="text-sm font-semibold text-neutral-900">Push notification</div>

                {permissionState === "unsupported" ? (
                  <div className="mt-1 text-xs leading-5 text-neutral-600">
                    อุปกรณ์/เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนผ่านเว็บ
                  </div>
                ) : permissionState === "denied" ? (
                  <div className="mt-1 space-y-2">
                    <div className="text-xs leading-5 text-neutral-600">
                      เบราว์เซอร์บล็อกการแจ้งเตือนอยู่ ต้องไปเปิดใหม่ใน Site Settings ของเว็บนี้
                    </div>
                    <button
                      type="button"
                      onClick={() => disableCurrentBrowserPush()}
                      disabled={pushBusy}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pushBusy ? "กำลังปิด..." : "ล้าง subscription ของอุปกรณ์นี้"}
                    </button>
                  </div>
                ) : permissionState === "granted" && pushSubscribed ? (
                  <div className="mt-1 space-y-2">
                    <div className="text-xs leading-5 text-neutral-600">
                      เปิดการแจ้งเตือนอยู่สำหรับอุปกรณ์นี้แล้ว
                    </div>
                    <button
                      type="button"
                      onClick={() => disableCurrentBrowserPush()}
                      disabled={pushBusy}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pushBusy ? "กำลังปิด..." : "ปิดการแจ้งเตือนอุปกรณ์นี้"}
                    </button>
                  </div>
                ) : permissionState === "granted" ? (
                  <div className="mt-1 space-y-2">
                    <div className="text-xs leading-5 text-neutral-600">
                      เบราว์เซอร์อนุญาตแล้ว แต่เครื่องนี้ยังไม่ได้ subscribe push
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEnablePush()}
                      disabled={pushBusy}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pushBusy ? "กำลังเปิด..." : "เปิดการแจ้งเตือนอุปกรณ์นี้"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 space-y-2">
                    <div className="text-xs leading-5 text-neutral-600">
                      ระบบจะเด้ง popup ขอสิทธิ์อัตโนมัติเมื่อยังไม่ได้ตอบรับ
                    </div>

                    {isIosWithoutStandalone && (
                      <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                        iPhone/iPad ต้อง Add to Home Screen ก่อน แล้วเปิดแอปจากไอคอนจึงจะขอ
                        push ได้
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowPushPrompt(true)}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Open permission popup
                    </button>
                  </div>
                )}

                {pushMessage && (
                  <div className="mt-2 text-xs leading-5 text-neutral-600">{pushMessage}</div>
                )}
              </div>

              <div className="h-[calc(100%-132px)] overflow-y-auto sm:h-auto sm:max-h-[calc(min(78vh,40rem)-132px)]">
                {loading && grouped.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-neutral-500">กำลังโหลด...</div>
                ) : grouped.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-neutral-500">
                    ยังไม่มีการแจ้งเตือน
                  </div>
                ) : (
                  grouped.map((item) => {
                    const unread = !item.readAt;
                    const title = getGroupedTitle(item);
                    const body = getGroupedBody(item);
                    const icon = getTypeIcon(item.type);

                    return (
                      <button
                        key={`${item.id}-${item.count}`}
                        type="button"
                        onClick={() => markAsRead(item.groupedIds, item.url)}
                        className={`relative block w-full border-b border-neutral-100 px-3 py-3 text-left transition hover:bg-neutral-50 sm:px-4 sm:py-4 ${
                          unread ? "bg-rose-50/30" : "bg-white"
                        }`}
                      >
                        {unread && (
                          <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-500" />
                        )}

                        <div className="flex items-start gap-3 pr-5">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base">
                            {icon}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-neutral-900">
                                {title}
                              </div>

                              {unread && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                                  New
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-sm leading-5 text-neutral-600">{body}</div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                              <span>{fmtDateTime(item.createdAt)}</span>
                              {item.count > 1 && unread && <span>{item.count} items</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between gap-2 bg-neutral-50 px-4 py-3">
                <div className="text-xs text-neutral-500">
                  unread {summary.unreadCount} • mention {summary.unreadMentions} • approval{" "}
                  {summary.unreadApprovals}
                </div>

                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => load()}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showPushPrompt && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="text-lg font-semibold text-neutral-900">Allow notifications?</div>

            <div className="mt-2 text-sm leading-6 text-neutral-600">
              เปิดการแจ้งเตือนเพื่อรับข้อความใหม่, mention และการอัปเดตการอนุมัติ
            </div>

            {isIosWithoutStandalone && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                สำหรับ iPhone/iPad ให้กด Share → Add to Home Screen แล้วเปิดแอปจากไอคอนก่อน
              </div>
            )}

            {permissionState === "denied" && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                ตอนนี้ browser บล็อกการแจ้งเตือนอยู่ ต้องไปเปิดใหม่ใน Site Settings ของเว็บนี้
              </div>
            )}

            {pushMessage && (
              <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                {pushMessage}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={dismissPromptForSession}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Not now
              </button>

              <button
                type="button"
                onClick={() => handleEnablePush()}
                disabled={pushBusy || permissionState === "denied"}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pushBusy ? "Loading..." : "Allow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}