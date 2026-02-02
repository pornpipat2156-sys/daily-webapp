"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TopRightAuth from "./TopRightAuth";
import { useSession } from "next-auth/react";

type Role = "USER" | "ADMIN" | "GENERATOR";

const navItems: { label: string; href: string; roles: Role[] }[] = [
  { label: "Daily report", href: "/daily-report", roles: ["USER", "ADMIN", "GENERATOR"] },
  { label: "Comentator", href: "/commentator", roles: ["ADMIN", "GENERATOR"] },
  { label: "Sumation", href: "/sumation", roles: ["ADMIN", "GENERATOR"] },
  { label: "Contact", href: "/contact", roles: ["USER", "ADMIN", "GENERATOR"] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useSession();

  const isLoggedIn = !!data?.user;
  const role = ((data?.user as any)?.role || "USER") as Role;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="font-semibold">DAILY-WEBAPP</div>
          <TopRightAuth />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-4 px-4 py-4">
        <aside className="w-60 shrink-0 rounded-xl border bg-white p-3">
          <div className="mb-3 text-xs font-semibold uppercase opacity-60">Tabs</div>

          <nav className="space-y-1">
            {navItems.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              const allowed = isLoggedIn && it.roles.includes(role);

              return (
                <Link
                  key={it.href}
                  href={allowed ? it.href : "/login"}
                  className={[
                    "block rounded-lg px-3 py-2 text-sm",
                    active ? "bg-black text-white" : "hover:bg-gray-50",
                    !allowed ? "opacity-40 pointer-events-none" : "",
                  ].join(" ")}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          {!isLoggedIn && (
            <div className="mt-4 rounded-lg border bg-gray-50 p-3 text-xs opacity-70">
              * ต้อง Login ก่อนถึงกดใช้งานแท็บได้
            </div>
          )}

          {isLoggedIn && (
            <div className="mt-4 rounded-lg border bg-gray-50 p-3 text-xs">
              <div className="font-semibold">Role</div>
              <div className="opacity-70">{role}</div>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 rounded-xl border bg-white p-4">{children}</main>
      </div>
    </div>
  );
}
