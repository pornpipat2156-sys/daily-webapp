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

const PUSH_PROMPT_SESSION_KEY = "daily-webapp-push-prompt-dismissed-session-v2";

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

function getTypePillClass(type: NotificationItem["type"]) {
  if (type === "MENTION") return "status-mention";
  if (type === "APPROVAL") return "status-success";
  return "status-info";
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
  const [permissionState, setPermissionState] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

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

  async function subscribeCurrentBrowser() {
    if (!supportsPushPrompt()) return false;

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      setPushMessage("ยังไม่ได้ตั้งค่า VAPID public key");
      return false;
    }

    const registration =
      (await navigator.serviceWorker.getRegistration("/sw.js")) ||
      (await navigator.serviceWorker.getRegistration()) ||
      (await navigator.serviceWorker.register("/sw.js"));

    const existingSub = await registration.pushManager.getSubscription();

    if (existingSub) {
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscription: existingSub.toJSON() }),
      });
      return true;
    }

    const newSub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription: newSub.toJSON() }),
    });

    if (!res.ok) {
      throw new Error("subscribe failed");
    }

    return true;
  }

  async function syncExistingGrantedPermission() {
    if (!supportsPushPrompt()) {
      setPermissionState("unsupported");
      return;
    }

    const currentPermission = Notification.permission;
    setPermissionState(currentPermission);

    if (currentPermission !== "granted") return;

    try {
      await subscribeCurrentBrowser();
    } catch (error) {
      console.error("syncExistingGrantedPermission error:", error);
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
      setPushMessage("ไม่สามารถเปิดการแจ้งเตือนได้");
    } finally {
      setPushBusy(false);
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

  useEffect(() => {
    load().catch(console.error);

    const id = window.setInterval(() => {
      load().catch(console.error);
    }, 15000);

    function onRefresh() {
      load().catch(console.error);
    }

    window.addEventListener("notifications:refresh", onRefresh);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("notifications:refresh", onRefresh);
    };
  }, []);

  useEffect(() => {
    syncExistingGrantedPermission().catch(console.error);
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

  useEffect(() => {
    if (!supportsPushPrompt()) {
      setPermissionState("unsupported");
      return;
    }

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

  const grouped = useMemo(() => groupNotifications(summary.items || []), [summary.items]);
  const isIosWithoutStandalone = isIosDevice() && !isStandaloneDisplayMode();

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="soft-btn relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/80 bg-white/90 text-neutral-700 shadow-sm hover:bg-white dark:bg-slate-900/60 dark:text-slate-200"
          aria-label="Notifications"
          title="Notifications"
          type="button"
        >
          <span className="text-lg">🔔</span>

          {summary.unreadCount > 0 && (
            <span className="status-danger absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-1 text-[11px] font-extrabold leading-none shadow-sm">
              {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
            </span>
          )}
        </button>

        {open && (
          <>
            <button
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/10 sm:bg-transparent"
              aria-label="Close notifications"
              type="button"
            />

            <div className="soft-card-strong fixed inset-x-3 top-[72px] z-50 max-h-[min(72dvh,38rem)] overflow-hidden sm:absolute sm:right-0 sm:top-[calc(100%+0.75rem)] sm:left-auto sm:w-[min(92vw,26rem)]">
              <div className="border-b border-border/80 px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-extrabold text-slate-900 dark:text-white">
                      Notifications
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {summary.unreadCount > 99 ? "99+" : summary.unreadCount} unread
                    </div>
                  </div>

                  {summary.unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="soft-btn status-danger rounded-full px-3 py-2 text-xs font-bold sm:text-sm"
                      type="button"
                    >
                      Mark All As Read
                    </button>
                  )}
                </div>
              </div>

              <div className="soft-scroll max-h-[calc(min(72dvh,38rem)-5.5rem)] overflow-y-auto">
                {loading && grouped.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    กำลังโหลด...
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
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
                        key={`${item.id}-${item.groupedIds.join("-")}`}
                        onClick={() => markAsRead(item.groupedIds, item.url)}
                        className={`relative block w-full border-b border-border/70 px-4 py-4 text-left transition hover:bg-white/80 sm:px-5 ${
                          unread
                            ? "bg-[linear-gradient(135deg,rgba(124,156,245,0.08),rgba(121,217,199,0.06))]"
                            : "bg-transparent"
                        }`}
                        type="button"
                      >
                        <div className="flex items-start gap-3">
                          <div className={getTypePillClass(item.type) + " inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-bold"}>
                            {icon}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100 sm:text-[15px]">
                                {title}
                              </div>

                              {unread && (
                                <span className="status-info rounded-full px-2 py-1 text-[11px] font-bold leading-none">
                                  New
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {body}
                            </div>

                            <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                              {fmtDateTime(item.createdAt)}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showPushPrompt && (
        <>
          <button
            onClick={dismissPromptForSession}
            className="fixed inset-0 z-[70] bg-slate-900/30 backdrop-blur-[2px]"
            aria-label="Close push prompt overlay"
            type="button"
          />

          <div className="soft-card-strong fixed inset-x-4 bottom-4 z-[80] mx-auto w-auto max-w-[30rem] p-5 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[28rem]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Allow notifications?
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  เปิดการแจ้งเตือนเพื่อรับข้อความใหม่, mention และการอัปเดตการอนุมัติ
                </div>
              </div>

              <button
                onClick={dismissPromptForSession}
                className="soft-btn inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-white/90 text-slate-500 shadow-sm hover:bg-white dark:bg-slate-900/60 dark:text-slate-300"
                type="button"
                aria-label="Dismiss push prompt"
              >
                ✕
              </button>
            </div>

            {isIosWithoutStandalone && (
              <div className="status-warning mt-4 rounded-2xl px-4 py-3 text-sm leading-6">
                สำหรับ iPhone/iPad ให้กด Share → Add to Home Screen แล้วเปิดแอปจากไอคอนก่อน
              </div>
            )}

            {permissionState === "denied" && (
              <div className="status-danger mt-4 rounded-2xl px-4 py-3 text-sm leading-6">
                ตอนนี้ browser บล็อกการแจ้งเตือนอยู่ ต้องไปเปิดใหม่ใน Site Settings ของเว็บนี้
              </div>
            )}

            {pushMessage && (
              <div className="status-info mt-4 rounded-2xl px-4 py-3 text-sm leading-6">
                {pushMessage}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={dismissPromptForSession}
                className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-border/80 bg-white/90 px-4 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/60 dark:text-slate-200"
                type="button"
              >
                Not now
              </button>

              <button
                onClick={() => handleEnablePush()}
                disabled={pushBusy}
                className="soft-btn inline-flex min-h-11 items-center justify-center rounded-2xl border border-primary/25 bg-[linear-gradient(135deg,rgba(124,156,245,0.92),rgba(121,217,199,0.92))] px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(124,156,245,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                {pushBusy ? "กำลังเปิด..." : "Enable notifications"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}