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
  const { data: session } = useSession();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [summary, setSummary] = useState({
    unreadCount: 0,
    unreadMentions: 0,
    unreadApprovals: 0,
  });

  const role = (((session?.user as any)?.role || "USER") as string).trim();
  const displayName =
    ((((session?.user as any)?.name &&
      String((session?.user as any).name).trim()) ||
      session?.user?.email ||
      "-") as string) || "-";
  const position =
    (((((session?.user as any)?.position &&
      String((session?.user as any).position).trim()) ||
      "-") as string) || "-");

  function isTabEnabled(href: string) {
    if (role !== "USER") return true;
    return href.startsWith("/daily-report") || href.startsWith("/contact");
  }

  const contactBadge = useMemo(() => {
    return summary.unreadMentions > 99
      ? "99+"
      : String(summary.unreadMentions || "");
  }, [summary.unreadMentions]);

  function renderNavItem(
    item: (typeof nav)[number],
    options?: {
      onNavigate?: () => void;
    }
  ) {
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
          options?.onNavigate?.();
        }}
        className={cn(
          "relative flex h-11 items-center justify-between rounded-xl px-3 transition",
          active
            ? "bg-neutral-900 text-white"
            : enabled
            ? "text-neutral-700 hover:bg-neutral-100"
            : "cursor-not-allowed text-neutral-300"
        )}
        title={item.label}
      >
        <span className="block truncate text-sm">{item.label}</span>

        {hasUnreadMentions && (
          <span className="ml-3 inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
            {contactBadge}
          </span>
        )}
      </Link>
    );
  }

  const desktopSidebar = (
    <div className="flex h-full w-72 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="flex h-20 items-center border-b border-neutral-200 px-4">
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold tracking-tight text-neutral-900">
            DAILY-WEBAPP
          </div>
          <div className="truncate text-sm text-neutral-500">
            Construction Collaboration
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-2">
          {nav.map((item) => renderNavItem(item))}
        </nav>
      </div>

      <div className="border-t border-neutral-200 p-3">
        <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">
          <div className="truncate text-sm font-semibold text-neutral-900">
            {displayName}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {role} • {position}
          </div>
        </div>
      </div>
    </div>
  );

  const mobileSidebar = (
    <div className="flex h-full w-[86vw] max-w-[320px] flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="flex h-20 items-center justify-between border-b border-neutral-200 px-4">
        <div className="min-w-0">
          <div className="truncate text-2xl font-bold tracking-tight text-neutral-900">
            DAILY-WEBAPP
          </div>
          <div className="truncate text-sm text-neutral-500">
            Construction Collaboration
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-sm text-neutral-600 shadow-sm hover:bg-neutral-100"
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          ‹
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-2">
          {nav.map((item) =>
            renderNavItem(item, {
              onNavigate: () => setMobileOpen(false),
            })
          )}
        </nav>
      </div>

      <div className="border-t border-neutral-200 p-3">
        <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">
          <div className="truncate text-sm font-semibold text-neutral-900">
            {displayName}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {role} • {position}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="hidden lg:flex">
        {desktopSidebar}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-6 backdrop-blur">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-neutral-900">
                {displayName}
              </div>
              <div className="truncate text-sm text-neutral-500">
                {role} • {position}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <NotificationBell onSummaryChange={setSummary} />
              <TopRightAuth />
            </div>
          </header>

          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <div className="lg:hidden">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-lg text-neutral-700 shadow-sm hover:bg-neutral-50"
              aria-label="Open sidebar"
            >
              ☰
            </button>

            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-neutral-900">
                {displayName}
              </div>
              <div className="truncate text-sm text-neutral-500">
                {role} • {position}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell onSummaryChange={setSummary} />
            <TopRightAuth />
          </div>
        </header>

        {mobileOpen && (
          <>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/30"
              aria-label="Close sidebar overlay"
            />

            <div className="fixed inset-y-0 left-0 z-50 shadow-2xl">
              {mobileSidebar}
            </div>
          </>
        )}

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}