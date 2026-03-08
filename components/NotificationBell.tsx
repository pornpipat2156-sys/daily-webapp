"use client";

import { useEffect, useMemo, useState } from "react";

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
    month: "2-digit",
    day: "2-digit",
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

  const grouped = useMemo(() => groupNotifications(summary.items || []), [summary.items]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-[380px] overflow-hidden border-l border-neutral-200 bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4">
                <div>
                  <div className="text-base font-semibold text-neutral-900">Notifications</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    unread {summary.unreadCount} • mention {summary.unreadMentions} • approval{" "}
                    {summary.unreadApprovals}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => load()}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    ปิด
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <div className="text-sm text-neutral-600">รายการล่าสุด</div>
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Mark all as read
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading && grouped.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-500">กำลังโหลด...</div>
                ) : grouped.length === 0 ? (
                  <div className="p-4 text-sm text-neutral-500">ยังไม่มีการแจ้งเตือน</div>
                ) : (
                  <div className="divide-y divide-neutral-100">
                    {grouped.map((item) => {
                      const unread = !item.readAt;
                      const isMention = item.type === "MENTION";
                      const isApproval = item.type === "APPROVAL";

                      let displayTitle = item.title;
                      if (item.count > 1 && unread) {
                        if (isMention) displayTitle = `${item.count} new mentions`;
                        if (isApproval) displayTitle = `${item.count} new approvals`;
                      }

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => markAsRead(item.groupedIds, item.url)}
                          className={`block w-full px-4 py-3 text-left transition hover:bg-neutral-50 ${
                            unread ? "bg-blue-50/60" : "bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="pt-0.5 text-lg">
                              {isMention ? "💬" : isApproval ? "✅" : "🔔"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="truncate text-sm font-semibold text-neutral-900">
                                  {displayTitle}
                                </div>
                                {unread && (
                                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
                                )}
                              </div>
                              <div className="mt-1 line-clamp-2 text-sm text-neutral-600">
                                {item.body}
                              </div>
                              <div className="mt-2 text-xs text-neutral-400">
                                {fmtDateTime(item.createdAt)}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}