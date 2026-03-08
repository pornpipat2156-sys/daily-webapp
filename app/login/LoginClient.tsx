"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FeaturePill({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "mint" | "pink" | "violet";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300"
      : tone === "pink"
      ? "bg-[rgba(247,199,217,0.18)] text-rose-700 dark:text-rose-300"
      : tone === "violet"
      ? "bg-[rgba(154,135,245,0.18)] text-violet-700 dark:text-violet-300"
      : "bg-[rgba(124,156,245,0.16)] text-blue-700 dark:text-blue-300";

  return (
    <span className={cn("rounded-full px-3 py-1.5 text-xs font-bold", toneClass)}>
      {children}
    </span>
  );
}

export default function LoginClient() {
  const params = useSearchParams();
  const from = params.get("from") || "/daily-report";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const forgotHref = useMemo(() => {
    const q = new URLSearchParams();
    q.set("from", from);
    if (email.trim()) q.set("email", email.trim());
    return `/forgot-password?${q.toString()}`;
  }, [from, email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: from,
      });

      if ((res as any)?.error) {
        setError("Login ไม่สำเร็จ (email/password ไม่ถูกต้อง)");
        return;
      }

      window.location.href = (res as any)?.url || from;
    } catch {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.08fr_minmax(0,460px)]">
        <div className="hidden lg:flex">
          <div className="soft-card-strong flex w-full flex-col justify-between rounded-[32px] bg-[linear-gradient(135deg,rgba(124,156,245,0.16),rgba(121,217,199,0.16),rgba(247,199,217,0.16))] p-8">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                Daily Webapp
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Construction
                <br />
                collaboration dashboard
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                ระบบรายงานประจำวัน แสดงความคิดเห็น อนุมัติรายงาน และติดต่อภายในโครงการ
                ในรูปแบบที่อ่านง่าย นุ่มตา และเหมาะกับทั้ง desktop และ mobile
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <FeaturePill tone="blue">Daily Report</FeaturePill>
              <FeaturePill tone="mint">Commentator</FeaturePill>
              <FeaturePill tone="violet">Approval</FeaturePill>
              <FeaturePill tone="pink">Project Chat</FeaturePill>
            </div>
          </div>
        </div>

        <div className="soft-card-strong rounded-[32px] p-5 sm:p-6 lg:p-8">
          <div className="mb-6 lg:hidden">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Daily Webapp
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sign in
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              เข้าสู่ระบบเพื่อใช้งานรายงานประจำวันและ workflow ภายในโครงการ
            </p>
          </div>

          <div className="mb-6 hidden lg:block">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Welcome back
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sign in
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              ใช้อีเมลที่ได้รับอนุญาตและรหัสผ่านของคุณเพื่อเข้าใช้งานระบบ
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
                className="soft-input h-12 w-full px-4 text-sm text-slate-700 placeholder:text-slate-400 dark:text-slate-100"
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={forgotHref}
                className="text-sm font-semibold text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                ลืมรหัสผ่านใช่ไหม?
              </Link>

              <Link
                href="/"
                className="text-sm font-semibold text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                กลับหน้าแรก
              </Link>
            </div>

            {error ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="soft-btn inline-flex min-h-12 w-full items-center justify-center rounded-[20px] border border-primary/25 bg-[linear-gradient(135deg,rgba(124,156,245,0.96),rgba(121,217,199,0.96))] px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(124,156,245,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}