"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/daily-report", label: "รายงานประจำวัน" },
  { href: "/commentator", label: "แสดงความคิดเห็น" },
  { href: "/summation", label: "การตรวจสอบและการอนุมัติ" },
  { href: "/input", label: "การสรุปผลข้อมูล" },
  { href: "/contact", label: "ติดต่อ" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6">
          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden rounded-lg border px-3 py-2 text-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>

          <div className="font-semibold tracking-wide">DAILY-WEBAPP</div>

          <div className="ml-auto">
            <button type="button" className="rounded-full border px-4 py-2 text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ===== Content grid ===== */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-3 py-3 sm:px-6 md:grid-cols-[auto_1fr]">
        {/* ===== Sidebar (Desktop) ===== */}
        <aside
          className={[
            "hidden md:flex md:flex-col md:sticky md:top-16 md:h-[calc(100dvh-4rem)]",
            "rounded-2xl border bg-card",
            collapsed ? "w-20" : "w-72",
          ].join(" ")}
        >
          <div className="flex items-center justify-between p-3">
            <div className="text-sm font-semibold">TABS</div>
            <button
              type="button"
              className="rounded-lg border px-2 py-1 text-xs"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Collapse sidebar"
            >
              {collapsed ? "»" : "«"}
            </button>
          </div>

          <nav className="flex-1 space-y-2 px-2 pb-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "block rounded-xl border px-3 py-2 text-sm",
                    active ? "bg-foreground text-background border-foreground" : "hover:bg-muted",
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
            <div className="text-xs font-semibold">Role</div>
            <div className="text-sm">USER</div>
          </div>
        </aside>

        {/* ===== Sidebar (Mobile Drawer) ===== */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* backdrop */}
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            />

            {/* panel */}
            <div className="absolute left-0 top-0 h-full w-[82%] max-w-[320px] bg-background border-r p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">TABS</div>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  ✕
                </button>
              </div>

              <nav className="mt-4 space-y-2">
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        "block rounded-xl border px-3 py-2 text-sm",
                        active ? "bg-foreground text-background border-foreground" : "hover:bg-muted",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 rounded-xl border bg-muted p-3">
                <div className="text-xs font-semibold">Role</div>
                <div className="text-sm">USER</div>
              </div>
            </div>
          </div>
        )}

        {/* ===== Main ===== */}
        <main className="no-x-overflow">
          {/* ทำให้เนื้อหากรอกข้อมูลเต็มความกว้างเสมอ */}
          <div className="no-x-overflow">{children}</div>
        </main>
      </div>
    </div>
  );
}
