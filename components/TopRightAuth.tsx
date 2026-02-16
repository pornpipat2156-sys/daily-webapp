// components/TopRightAuth.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

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

  const displayName =
    (namePart && namePart.trim()) ||
    email ||
    "Account";

  const displayPosition = (position && position.trim()) || "-";

  return { displayName, position: displayPosition };
}

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

  const { displayName, position } = parseNameAndPosition(data.user);

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:block text-right">
        <div className="text-sm font-semibold leading-4">{displayName}</div>
        <div className="text-xs opacity-60">{position}</div>
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
