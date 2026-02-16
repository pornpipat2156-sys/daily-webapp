// components/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TopRightAuth from "./TopRightAuth";
import { useSession } from "next-auth/react";

const nav = [
  { href: "/daily-report", label: "รายงานประจำวัน" },
  { href: "/commentator", label: "แสดงความคิดเห็น" },
  { href: "/summation", label: "การตรวจสอบและการอนุมัติ" },
  { href: "/input", label: "การสรุปผลข้อมูล" },
  { href: "/contact", label: "ติดต่อ" },
];

export default function SidebarShell({
  role = "USER",
  children,
}: {
  role?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ✅ role prop ยังรับไว้เหมือนเดิม (ไม่กระทบสิทธิ์/logic อื่น) แต่ไม่แสดงบน UI
  void role;

  const { data: session } = useSession();

  const displayName =
    ((session?.user as any)?.name && String((session?.user as any).name).trim()) ||
    session?.user?.email ||
    "-";

  const position =
    (((session?.user as any)?.position && String((session?.user as any).position).trim()) ||
      "-") as string;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6">
          {/* Mobile menu */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm"
            onClick={() => setOpenMobile(true)}
            aria-label="Open menu"
            type="button"
          >
            ☰
          </button>

          <div className="font-semibold tracking-wide">DAILY-WEBAPP</div>

          <div className="ml-auto">
            <TopRightAuth />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[auto_1fr] gap-3 px-3 sm:px-6 py-3">
        {/* Desktop sidebar */}
        <aside
          className={[
            "hidden md:flex md:flex-col md:sticky md:top-16 md:h-[calc(100dvh-4rem)]",
            "rounded-2xl border bg-card",
            collapsed ? "w-20" : "w-72",
          ].join(" ")}
        >
          <div className="flex items-center justify-between p-3">
            <div className={collapsed ? "text-xs font-semibold" : "text-sm font-semibold"}>TABS</div>
            <button
              className="rounded-lg border px-2 py-1 text-xs"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Collapse sidebar"
              type="button"
            >
              {collapsed ? "»" : "«"}
            </button>
          </div>

          <nav className="flex-1 px-2 pb-2 space-y-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-xl px-3 py-2 text-sm border",
                    active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted",
                    collapsed ? "text-[0px] py-3" : "",
                  ].join(" ")}
                  title={collapsed ? item.label : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="m-3 rounded-xl border bg-muted p-3">
            <div className="text-xs font-semibold">ตำแหน่ง : {position}</div>
            <div className="text-sm">{displayName}</div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {openMobile && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpenMobile(false)}
              aria-label="Close menu backdrop"
              type="button"
            />
            <div className="absolute left-0 top-0 h-full w-[82%] max-w-[320px] bg-background border-r p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">TABS</div>
                <button
                  className="rounded-lg border px-3 py-2 text-sm"
                  onClick={() => setOpenMobile(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <nav className="mt-3 space-y-2">
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpenMobile(false)}
                      className={[
                        "block rounded-xl px-3 py-2 text-sm border",
                        active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 rounded-xl border bg-muted p-3">
                <div className="text-xs font-semibold">ตำแหน่ง : {position}</div>
                <div className="text-sm">{displayName}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
