"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function TopRightAuth() {
  const { data, status } = useSession();

  if (status === "loading") {
    return (
      <div className="hidden h-11 min-w-[120px] items-center justify-center rounded-2xl border border-border/80 bg-white/80 px-4 text-sm text-slate-400 shadow-sm sm:inline-flex dark:bg-slate-900/60">
        Loading...
      </div>
    );
  }

  if (!data?.user) {
    return (
      <button
        onClick={() => signIn(undefined, { callbackUrl: "/daily-report" })}
        className="soft-btn inline-flex h-11 items-center justify-center rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,rgba(124,156,245,0.18),rgba(121,217,199,0.12))] px-4 text-sm font-semibold text-slate-700 shadow-sm hover:border-primary/30 hover:bg-white dark:text-slate-100"
        title="Login"
        type="button"
      >
        Login
      </button>
    );
  }

  const email = data.user.email || "";
  const rawName = (data.user as any)?.name ? String((data.user as any).name).trim() : "";
  const displayName =
    rawName && rawName.toLowerCase() !== email.toLowerCase() ? rawName : "Account";
  const position = ((data.user as any)?.position && String((data.user as any).position).trim()) || "-";

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <div className="rounded-2xl border border-border/80 bg-white/88 px-4 py-2 shadow-sm dark:bg-slate-900/60">
        <div className="max-w-[180px] truncate text-sm font-bold text-slate-800 dark:text-slate-100">
          {displayName}
        </div>
        <div className="max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400">
          {position}
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="soft-btn inline-flex h-11 items-center justify-center rounded-2xl border border-border/80 bg-white/88 px-4 text-sm font-semibold text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/60 dark:text-slate-200"
        title="Logout"
        type="button"
      >
        Logout
      </button>
    </div>
  );
}