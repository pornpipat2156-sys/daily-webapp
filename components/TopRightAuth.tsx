"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function TopRightAuth() {
  const { data, status } = useSession();

  if (status === "loading") {
    return (
      <div className="inline-flex h-10 items-center rounded-full border border-border/80 bg-white/80 px-3 text-xs font-semibold text-slate-400 shadow-sm dark:bg-slate-900/70 dark:text-slate-500">
        ...
      </div>
    );
  }

  if (!data?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn(undefined, { callbackUrl: "/daily-report" })}
        className="soft-btn inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border/80 bg-white/90 px-3 text-sm font-semibold text-slate-700 shadow-sm whitespace-nowrap hover:bg-white dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-900 sm:px-4"
        title="Login"
        aria-label="Login"
      >
        <span className="text-base leading-none sm:hidden">↪</span>
        <span className="hidden sm:inline">Login</span>
      </button>
    );
  }

  const email = data.user.email || "";
  const rawName = (data.user as any)?.name ? String((data.user as any).name).trim() : "";
  const displayName =
    rawName && rawName.toLowerCase() !== email.toLowerCase() ? rawName : "Account";
  const position =
    ((data.user as any)?.position && String((data.user as any).position).trim()) || "-";

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="hidden min-w-0 text-right md:block">
        <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
          {displayName}
        </div>
        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{position}</div>
      </div>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="soft-btn inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-border/80 bg-white/90 px-3 text-sm font-semibold text-slate-700 shadow-sm whitespace-nowrap hover:bg-white dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-900 sm:px-4"
        title="Logout"
        aria-label="Logout"
      >
        <span className="text-base leading-none sm:hidden">↩</span>
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}