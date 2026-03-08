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
  meta: Record<string, any> | null;
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
      ? String(item.meta.projectName || "").trim()
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
    function onPointerDown(e: MouseEvent) {
      if (!open) return;
      if (!wrapRef.current) return;

      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const grouped = useMemo(
    () => groupNotifications(summary.items || []),
    [summary.items]
  );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        aria-label="Notifications"
        title="Notifications"
      >
        {summary.unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[22px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[11px] font-bold text-white shadow">
            {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
          </span>
        )}
        <span className="text-xl">🔔</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/10 sm:bg-transparent"
            aria-label="Close notifications"
          />

          <div className="fixed inset-x-2 top-[88px] z-50 max-h-[calc(100dvh-104px)] w-auto overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl sm:absolute sm:right-0 sm:left-auto sm:top-12 sm:w-[92vw] sm:max-w-md sm:max-h-[70vh]">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-base font-semibold text-neutral-900">
                  Notifications
                </div>

                {summary.unreadCount > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600">
                    {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="shrink-0 text-xs font-semibold text-rose-500 transition hover:text-rose-600 sm:text-sm"
              >
                Mark All As Read
              </button>
            </div>

            <div className="max-h-[calc(100dvh-220px)] overflow-y-auto sm:max-h-[56vh]">
              {loading && grouped.length === 0 ? (
                <div className="px-4 py-6 text-sm text-neutral-500">
                  กำลังโหลด...
                </div>
              ) : grouped.length === 0 ? (
                <div className="px-4 py-6 text-sm text-neutral-500">
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
                      type="button"
                      key={`${item.groupKey || item.id}-${item.groupedIds.join(",")}`}
                      onClick={() => markAsRead(item.groupedIds, item.url)}
                      className={`relative block w-full border-b border-neutral-100 px-3 py-3 text-left transition hover:bg-neutral-50 sm:px-4 sm:py-4 ${
                        unread ? "bg-rose-50/30" : "bg-white"
                      }`}
                    >
                      {unread && (
                        <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-rose-500" />
                      )}

                      <div className="mb-1 flex items-start gap-2 pr-6">
                        <span className="pt-0.5 text-base leading-none">
                          {icon}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start gap-2">
                            <div className="min-w-0 flex-1 text-sm font-semibold text-neutral-900 sm:text-[15px]">
                              <span className="line-clamp-2 break-words">
                                {title}
                              </span>
                            </div>

                            {unread && (
                              <span className="mt-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                                New
                              </span>
                            )}
                          </div>

                          <div className="mt-1 line-clamp-3 break-words text-xs text-neutral-600 sm:text-sm">
                            {body}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 sm:text-xs">
                            <span>{fmtDateTime(item.createdAt)}</span>

                            {item.count > 1 && unread && (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-500">
                                {item.count} items
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 text-[11px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:text-xs">
              <div className="min-w-0 break-words">
                unread {summary.unreadCount} • mention {summary.unreadMentions} •
                approval {summary.unreadApprovals}
              </div>

              <div className="flex items-center justify-end gap-2">
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
  );
}