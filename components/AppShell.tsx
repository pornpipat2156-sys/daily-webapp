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

export default function AppShell({ children }: { children: React.ReactNode }) {
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
    (((session?.user as any)?.name && String((session?.user as any).name).trim()) ||
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
    return summary.unreadMentions > 99 ? "99+" : String(summary.unreadMentions || "");
  }, [summary.unreadMentions]);

  const sidebar = (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-neutral-200 bg-white",
        collapsed ? "w-[88px]" : "w-[280px]"
      )}
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4">
        <div className={cn("min-w-0", collapsed && "hidden")}>
          <div className="truncate text-base font-semibold text-neutral-900">DAILY-WEBAPP</div>
          <div className="truncate text-xs text-neutral-500">Construction Collaboration</div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const enabled = isTabEnabled(item.href);
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const isContact = item.href === "/contact";

          return (
            <Link
              key={item.href}
              href={enabled ? item.href : "#"}
              onClick={(e) => {
                if (!enabled) e.preventDefault();
                setMobileOpen(false);
              }}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-neutral-900 text-white"
                  : enabled
                  ? "text-neutral-700 hover:bg-neutral-100"
                  : "cursor-not-allowed text-neutral-300"
              )}
            >
              <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>

              {!collapsed && isContact && summary.unreadMentions > 0 && (
                <span
                  className={cn(
                    "ml-3 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    active ? "bg-white/20 text-white" : "bg-red-500 text-white"
                  )}
                >
                  {contactBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-neutral-200 px-4 py-4">
          <div className="truncate text-sm font-semibold text-neutral-900">{displayName}</div>
          <div className="mt-1 truncate text-xs text-neutral-500">
            {role} • {position}
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <div className="hidden md:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          />
          <div className="absolute left-0 top-0 h-full w-[280px]">{sidebar}</div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50 md:hidden"
              >
                ☰
              </button>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-900">
                  {displayName}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {role} • {position}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell onSummaryChange={setSummary} />
              <TopRightAuth />
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}