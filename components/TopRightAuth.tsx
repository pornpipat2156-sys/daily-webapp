"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function TopRightAuth() {
  const { data, status } = useSession();

  if (status === "loading") {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />;
  }

  if (!data?.user) {
    return (
      <button
        onClick={() => signIn(undefined, { callbackUrl: "/daily-report" })}
        className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
        title="Login"
      >
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
        Login
      </button>
    );
  }

  const role = (data.user as any)?.role || "USER";
  const email = data.user.email || "";

  const rawName = (data.user as any)?.name ? String((data.user as any).name).trim() : "";

  const displayName =
    rawName && rawName.toLowerCase() !== email.toLowerCase()
      ? rawName
      : "Account";
  const name = displayName;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right">
        <div className="text-sm font-semibold leading-4">{displayName}</div>
        <div className="text-xs opacity-60">{role}</div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50"
        title="Logout"
      >
        Logout
      </button>
    </div>
  );
}
