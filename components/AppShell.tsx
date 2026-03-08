"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import TopRightAuth from "./TopRightAuth";
import NotificationBell from "./NotificationBell";

const nav = [
  { href: "/daily-report", label: "รายงานประจำวัน" },
  { href: "/commentator", label: "แสดงความคิดเห็น" },
  { href: "/summation", label: "การตรวจสอบและการอนุมัติ" },
  { href: "/input", label: "การสรุปผลข้อมูล" },
  { href: "/contact", label: "ติดต่อ" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [summary, setSummary] = useState({
    unreadCount: 0,
    unreadMentions: 0,
    unreadApprovals: 0,
  });

  const { data: session } = useSession();
  const role = ((session?.user as any)?.role || "USER") as string;
  const displayName =
    (((session?.user as any)?.name &&
      String((session?.user as any).name).trim()) ||
      session?.user?.email ||
      "-") as string;
  const position =
    ((((session?.user as any)?.position &&
      String((session?.user as any).position).trim()) ||
      "-") as string);

  function isTabEnabled(href: string) {
    if (role !== "USER") return true;
    return href.startsWith("/daily-report") || href.startsWith("/contact");
  }

  const contactBadge = useMemo(() => {
    return summary.unreadMentions > 99
      ? "99+"
      : String(summary.unreadMentions || "");
  }, [summary.unreadMentions]);

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-neutral-200 bg-white transition-all",
        collapsed ? "w-[92px]" : "w-[280px]"
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-4">
        <div className={cn("min-w-0", collapsed && "hidden")}>
          <div className="text-sm font-bold tracking-wide text-neutral-900">
            DAILY-WEBAPP
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            Construction Collaboration
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item) => {
          const enabled = isTabEnabled(item.href);
          const active =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const isContact = item.href === "/contact";
          const hasUnreadMentions = isContact && summary.unreadMentions > 0;

          return (
            <Link
              key={item.href}
              href={enabled ? item.href : "#"}
              onClick={(e) => {
                if (!enabled) e.preventDefault();
                setMobileOpen(false);
              }}
              className={cn(
                "relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-neutral-900 text-white"
                  : enabled
                  ? "text-neutral-700 hover:bg-neutral-100"
                  : "cursor-not-allowed text-neutral-300"
              )}
            >
              <span className="truncate">{collapsed ? item.label.slice(0, 2) : item.label}</span>

              {!collapsed && hasUnreadMentions && (
                <span
                  className={cn(
                    "ml-3 inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-rose-500 text-white"
                  )}
                >
                  {contactBadge}
                </span>
              )}

              {collapsed && hasUnreadMentions && (
                <span
                  className={cn(
                    "absolute right-2 top-2 h-2.5 w-2.5 rounded-full",
                    active ? "bg-white" : "bg-rose-500"
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-neutral-200 px-4 py-4">
          <div className="truncate text-sm font-medium text-neutral-900">
            {displayName}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {role} • {position}
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="hidden min-h-screen md:flex">
        {sidebar}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-900">
                {displayName}
              </div>
              <div className="text-xs text-neutral-500">
                {role} • {position}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NotificationBell onSummaryChange={setSummary} />
              <TopRightAuth />
            </div>
          </header>

          <main className="min-w-0 flex-1 p-4">{children}</main>
        </div>
      </div>

      <div className="md:hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              ☰
            </button>

            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-neutral-900">
                {displayName}
              </div>
              <div className="text-[11px] text-neutral-500">
                {role} • {position}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell onSummaryChange={setSummary} />
            <TopRightAuth />
          </div>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex">
            <button
              type="button"
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            />
            <div className="relative z-10 h-full w-[280px] bg-white shadow-xl">
              {sidebar}
            </div>
          </div>
        )}

        <main className="p-3">{children}</main>
      </div>
    </div>
  );
}