// components/AppShell.tsx
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

function parseNameAndPosition(user: any): { displayName: string; position: string } {
  const email = user?.email ? String(user.email).trim() : "";
  const rawName = user?.name ? String(user.name).trim() : "";

  let namePart = rawName;
  let position = "";

  // Pattern: "Name (Position)"
  const mParen = rawName.match(/\(([^)]+)\)\s*$/);
  if (mParen?.[1]) {
    position = mParen[1].trim();
    namePart = rawName.replace(/\(([^)]+)\)\s*$/, "").trim();
  } else if (rawName.includes("|")) {
    // Pattern: "Name | Position"
    const parts = rawName.split("|").map((s) => s.trim());
    namePart = parts[0] || "";
    position = parts.slice(1).join(" | ").trim();
  } else if (rawName.includes(" - ")) {
    // Pattern: "Name - Position"
    const parts = rawName.split(" - ").map((s) => s.trim());
    namePart = parts[0] || "";
    position = parts.slice(1).join(" - ").trim();
  }

  const displayName = (namePart && namePart.trim()) || email || "-";
  const displayPosition = (position && position.trim()) || "-";

  return { displayName, position: displayPosition };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data: session } = useSession();
  const role = ((session?.user as any)?.role || "USER") as string; // ✅ คงเดิมเพื่อ permission
  const { displayName, position } = parseNameAndPosition(session?.user);

  function isTabEnabled(href: string) {
    if (role !== "USER") return true; // ADMIN/SUPERADMIN กดได้หมด (ตามเงื่อนไขเดิม)
    return href.startsWith("/daily-report") || href.startsWith("/contact");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6">
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
            {/* ✅ ใช้ตัวที่เชื่อม next-auth จริง */}
            <TopRightAuth />
          </div>
        </div>
      </header>

      {/* ===== Content ===== */}
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr]">
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
                const enabled = isTabEnabled(item.href);

                const baseClass = [
                  "block rounded-xl border px-3 py-2 text-sm",
                  active ? "bg-foreground text-background border-foreground" : "hover:bg-muted",
                  collapsed ? "text-[0px] py-3" : "",
                ].join(" ");

                // ✅ USER เห็นทุกแท็บ แต่แท็บที่ไม่ได้สิทธิ์: จาง + กดไม่ได้
                if (!enabled) {
                  return (
                    <div
                      key={item.href}
                      className={[baseClass, "opacity-40 cursor-not-allowed hover:bg-transparent"].join(" ")}
                      title="ไม่มีสิทธิ์เข้าถึง"
                      aria-disabled="true"
                    >
                      {item.label}
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={baseClass}
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

          {/* ===== Sidebar (Mobile Drawer) ===== */}
          {mobileOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              />
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
                    const enabled = isTabEnabled(item.href);

                    const baseClass = [
                      "block rounded-xl border px-3 py-2 text-sm",
                      active ? "bg-foreground text-background border-foreground" : "hover:bg-muted",
                    ].join(" ");

                    if (!enabled) {
                      return (
                        <div
                          key={item.href}
                          className={[baseClass, "opacity-40 cursor-not-allowed hover:bg-transparent"].join(" ")}
                          title="ไม่มีสิทธิ์เข้าถึง"
                          aria-disabled="true"
                        >
                          {item.label}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={baseClass}
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

          {/* ===== Main ===== */}
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
