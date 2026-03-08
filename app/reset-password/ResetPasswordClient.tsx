"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function HelperPill({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "mint" | "violet";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300"
      : tone === "violet"
      ? "bg-[rgba(154,135,245,0.18)] text-violet-700 dark:text-violet-300"
      : "bg-[rgba(124,156,245,0.16)] text-blue-700 dark:text-blue-300";

  return <span className={cn("rounded-full px-3 py-1.5 text-xs font-bold", toneClass)}>{children}</span>;
}

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => (params.get("token") || "").trim(), [params]);

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!token) {
      setMsg("ไม่พบ token — กรุณากด “ขอ link ใหม่”");
      return;
    }
    if (newPassword.length < 8) {
      setMsg("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (newPassword !== confirm) {
      setMsg("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/confirm-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setMsg(data?.message || "ตั้งรหัสผ่านไม่สำเร็จ (token อาจหมดอายุ/ถูกใช้แล้ว) — ลองขอใหม่");
        return;
      }

      setMsg("ตั้งรหัสผ่านสำเร็จ ✅ กำลังพาไปหน้า Login...");
      setTimeout(() => router.push("/login"), 700);
    } catch {
      setMsg("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-5xl items-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_minmax(0,460px)]">
        <div className="hidden lg:flex">
          <div className="soft-card-strong flex w-full flex-col justify-between rounded-[32px] bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.16),rgba(247,199,217,0.16))] p-8">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                New password
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Create a secure
                <br />
                new password
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-300">
                ตั้งรหัสผ่านใหม่เพื่อกลับเข้าใช้งานระบบ Daily Webapp ได้อย่างปลอดภัย
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <HelperPill tone="blue">8+ Characters</HelperPill>
              <HelperPill tone="mint">Token Required</HelperPill>
              <HelperPill tone="violet">Go to Login</HelperPill>
            </div>
          </div>
        </div>

        <div className="soft-card-strong rounded-[32px] p-5 sm:p-6 lg:p-8">
          <div className="mb-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Reset password
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ตั้งรหัสผ่านใหม่
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              กำหนดรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร และยืนยันให้ตรงกัน
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                รหัสผ่านใหม่
              </label>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
                placeholder="อย่างน้อย 8 ตัวอักษร"
                className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                ยืนยันรหัสผ่าน
              </label>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
                className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>

            {msg ? (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                {msg}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="soft-btn inline-flex min-h-12 w-full items-center justify-center rounded-[20px] border border-primary/25 bg-[linear-gradient(135deg,rgba(124,156,245,0.96),rgba(121,217,199,0.96))] px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(124,156,245,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </button>

            <div className="flex flex-col items-center gap-2 pt-1 sm:flex-row sm:justify-center sm:gap-4">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                ขอ link ใหม่
              </Link>
              <Link
                href="/login"
                className="text-sm font-semibold text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                ไปหน้า Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}