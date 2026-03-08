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

function groupNotifications(items: NotificationItem[]) {
  const grouped: Array<
    NotificationItem & {
      count: number;
      groupedIds: string[];
    }
  > = [];

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
  }

  return grouped;
}

function getTypeIcon(type: NotificationItem["type"]) {
  if (type === "MENTION") return "💬";
  if (type === "APPROVAL") return "✅";
  return "🔔";
}

function getGroupedTitle(
  item: NotificationItem & { count: number; groupedIds: string[] }
) {
  if (item.count <= 1 || item.readAt) return item.title;
  if (item.type === "MENTION") return `${item.count} new mentions`;
  if (item.type === "APPROVAL") return `${item.count} new approvals`;
  return `${item.count} new notifications`;
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
      const res = await fetch("/api/notifications?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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

    return () => window.clearInterval(id);
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

  const grouped = useMemo(() => groupNotifications(summary.items || []), [summary.items]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50"
        aria-label="Notifications"
        title="Notifications"
      >
        <span className="text-lg">🔔</span>
        {summary.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white">
            {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-[80] w-[92vw] max-w-[420px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-[26px] font-semibold leading-none text-neutral-800">
                Notifications
              </div>
              {summary.unreadCount > 0 && (
                <span className="inline-flex min-w-[24px] items-center justify-center rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold leading-none text-white">
                  {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="shrink-0 text-sm font-semibold text-rose-500 transition hover:text-rose-600"
            >
              Mark All As Read
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {loading && grouped.length === 0 ? (
              <div className="px-4 py-5 text-sm text-neutral-500">กำลังโหลด...</div>
            ) : grouped.length === 0 ? (
              <div className="px-4 py-5 text-sm text-neutral-500">ยังไม่มีการแจ้งเตือน</div>
            ) : (
              <div>
                {grouped.map((item) => {
                  const unread = !item.readAt;
                  const title = getGroupedTitle(item);
                  const icon = getTypeIcon(item.type);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => markAsRead(item.groupedIds, item.url)}
                      className={`relative block w-full border-b border-neutral-100 px-4 py-4 text-left transition hover:bg-neutral-50 ${
                        unread ? "bg-rose-50/30" : "bg-white"
                      }`}
                    >
                      {unread && <span className="absolute left-0 top-0 h-full w-1 bg-rose-500" />}

                      <div className="flex items-start gap-3 pl-1">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg">
                          {icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="line-clamp-1 text-[15px] font-semibold text-neutral-800">
                              {title}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {unread && (
                                <span className="h-4 w-4 rounded-full border-2 border-neutral-400 bg-white" />
                              )}
                            </div>
                          </div>

                          <div className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">
                            {item.body}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-400">
                            <span className="truncate">{fmtDateTime(item.createdAt)}</span>
                            {item.count > 1 && unread && (
                              <span className="shrink-0 font-medium text-rose-500">
                                {item.count} items
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3">
            <div className="text-xs text-neutral-500">
              unread {summary.unreadCount} • mention {summary.unreadMentions} • approval{" "}
              {summary.unreadApprovals}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => load()}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}