"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
        headers: { "Content-Type": "application/json" },
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
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-7xl items-start justify-center px-3 pt-16 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold">ลืมรหัสผ่าน</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            ใส่อีเมลที่ได้รับอนุญาต แล้วระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
              />
            </div>

            {msg && <div className="text-sm">{msg}</div>}
            {err && <div className="text-sm text-destructive">{err}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>

            <Link href={backHref} className="block text-center text-sm underline underline-offset-4 hover:opacity-80">
              กลับไปหน้า Login
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
