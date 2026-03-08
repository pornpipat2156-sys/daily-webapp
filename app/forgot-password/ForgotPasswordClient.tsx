"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function InfoPill({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "mint" | "amber";
}) {
  const toneClass =
    tone === "mint"
      ? "bg-[rgba(121,217,199,0.16)] text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
      ? "bg-[rgba(243,190,114,0.18)] text-amber-700 dark:text-amber-300"
      : "bg-[rgba(124,156,245,0.16)] text-blue-700 dark:text-blue-300";

  return <span className={cn("rounded-full px-3 py-1.5 text-xs font-bold", toneClass)}>{children}</span>;
}

export default function ForgotPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();

  const from = params.get("from") || "/daily-report";
  const defaultEmail = params.get("email") || "";

  const [email, setEmail] = useState(defaultEmail);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const backHref = useMemo(() => `/login?from=${encodeURIComponent(from)}`, [from]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/request-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setErr("ส่งลิงก์ไม่สำเร็จ (ตรวจสอบอีเมลใน AllowedEmail / ตั้งค่า SMTP / ดู Logs)");
        return;
      }

      setMsg("ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบอีเมล (รวมถึง Spam)");
      setTimeout(() => router.push(backHref), 1200);
    } catch {
      setErr("เกิดข้อผิดพลาดในการเชื่อมต่อ");
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
                Password Recovery
              </div>
              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Reset your
                <br />
                password safely
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-300">
                ใส่อีเมลที่ได้รับอนุญาต แล้วระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <InfoPill tone="blue">Allowed Email</InfoPill>
              <InfoPill tone="mint">Reset Link</InfoPill>
              <InfoPill tone="amber">Check Spam</InfoPill>
            </div>
          </div>
        </div>

        <div className="soft-card-strong rounded-[32px] p-5 sm:p-6 lg:p-8">
          <div className="mb-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
              Forgot password
            </div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ขอรีเซ็ตรหัสผ่าน
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ
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

            {msg ? (
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                {msg}
              </div>
            ) : null}

            {err ? (
              <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {err}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="soft-btn inline-flex min-h-12 w-full items-center justify-center rounded-[20px] border border-primary/25 bg-[linear-gradient(135deg,rgba(124,156,245,0.96),rgba(121,217,199,0.96))] px-6 text-sm font-bold text-white shadow-[0_16px_34px_rgba(124,156,245,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>

            <div className="flex justify-center pt-1">
              <Link
                href={backHref}
                className="text-sm font-semibold text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                กลับไปหน้า Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}