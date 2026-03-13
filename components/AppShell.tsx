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

  const role = ((((session?.user as any)?.role || "USER") as string) || "USER").trim();
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
    return summary.unreadMentions > 99 ? "99+" : String(summary.unreadMentions || "");
  }, [summary.unreadMentions]);

  function renderNavItem(
    item: (typeof nav)[number],
    options?: { onNavigate?: () => void; mobile?: boolean }
  ) {
    const enabled = isTabEnabled(item.href);
    const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
          "soft-btn relative flex items-center justify-between gap-3 overflow-hidden border px-4 text-sm font-semibold",
          options?.mobile ? "min-h-12 rounded-2xl" : "min-h-12 rounded-2xl",
          active
            ? "border-primary/30 bg-[linear-gradient(135deg,rgba(124,156,245,0.18),rgba(121,217,199,0.16))] text-slate-900 shadow-[0_12px_30px_rgba(124,156,245,0.16)] dark:text-white"
            : enabled
            ? "border-border/80 bg-white/80 text-slate-700 hover:border-primary/30 hover:bg-white dark:bg-slate-900/60 dark:text-slate-200"
            : "cursor-not-allowed border-border/70 bg-slate-100/70 text-slate-300 dark:bg-slate-900/50 dark:text-slate-500"
        )}
        title={item.label}
      >
        <span className="truncate">{item.label}</span>

        {hasUnreadMentions && (
          <span className="status-mention inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-[11px] font-bold leading-none shadow-sm">
            {contactBadge}
          </span>
        )}
      </Link>
    );
  }

  const desktopSidebar = (
    <aside className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-[290px] shrink-0 xl:block">
      <div className="soft-card soft-scroll flex h-full flex-col overflow-hidden p-4">
        <div className="rounded-[22px] bg-[linear-gradient(135deg,rgba(124,156,245,0.18),rgba(121,217,199,0.16),rgba(247,199,217,0.14))] p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
            Daily Webapp
          </div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            รายงานประจำวัน
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            บันทึกรายงานประจำวันและติดตามความคืบหน้าของโครงการก่อสร้าง
          </div>
        </div>

        <div className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
          {nav.map((item) => renderNavItem(item))}
        </div>

        <div className="mt-5 rounded-[22px] border border-border/80 bg-card-soft/90 p-4 dark:bg-slate-900/50">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">
            Signed in as
          </div>
          <div className="mt-2 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
            {displayName}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {position}
          </div>
        </div>
      </div>
    </aside>
  );

  const mobileSidebar = (
    <div className="soft-card-strong soft-scroll fixed inset-y-3 left-3 z-50 flex w-[min(86vw,22rem)] max-w-full flex-col overflow-hidden p-4 xl:hidden">
      <div className="flex items-start justify-between gap-3 rounded-[22px] bg-[linear-gradient(135deg,rgba(124,156,245,0.18),rgba(121,217,199,0.16),rgba(247,199,217,0.14))] p-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
            Daily Webapp
          </div>
          <div className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            รายงานประจำวัน
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            บันทึกรายงานประจำวันและติดตามความคืบหน้าของโครงการก่อสร้าง
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(false)}
          className="soft-btn inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-white/90 text-base text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/70 dark:text-slate-200"
          aria-label="Close sidebar"
          title="Close sidebar"
          type="button"
        >
          ✕
        </button>
      </div>

      <div className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
        {nav.map((item) =>
          renderNavItem(item, {
            onNavigate: () => setMobileOpen(false),
            mobile: true,
          })
        )}
      </div>

      <div className="mt-5 rounded-[22px] border border-border/80 bg-card-soft/90 p-4 dark:bg-slate-900/50">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">
          Signed in as
        </div>
        <div className="mt-2 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
          {displayName}
        </div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {role} • {position}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1680px] gap-5 px-3 py-3 sm:px-4 sm:py-4 lg:px-5 xl:px-6">
        {desktopSidebar}

        <div className="min-w-0 flex-1">
          <header className="soft-shell sticky top-3 z-30 rounded-[26px] border border-white/60 px-3 py-3 shadow-[0_10px_30px_rgba(148,163,184,0.14)] sm:px-4 lg:px-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="soft-btn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-white/90 text-lg text-slate-700 shadow-sm hover:bg-white xl:hidden"
                aria-label="Open sidebar"
                type="button"
              >
                ☰
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100 sm:text-base">
                  {displayName}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                  {role} • {position}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <NotificationBell onSummaryChange={setSummary} />
                <TopRightAuth />
              </div>
            </div>
          </header>

          <main className="pt-4 sm:pt-5">
            <div className="min-w-0">{children}</div>
          </main>
        </div>
      </div>

      {mobileOpen && (
        <>
          <button
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/28 backdrop-blur-[2px] xl:hidden"
            aria-label="Close sidebar overlay"
            type="button"
          />
          {mobileSidebar}
        </>
      )}
    </div>
  );
}