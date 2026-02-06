"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!token) {
      setErr("ลิงก์ไม่ถูกต้อง (ไม่มี token)");
      return;
    }
    if (password.length < 8) {
      setErr("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setErr("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        setErr("ตั้งรหัสผ่านไม่สำเร็จ (token อาจหมดอายุ/ถูกใช้แล้ว) — ลองขอใหม่");
        return;
      }

      setMsg("ตั้งรหัสผ่านสำเร็จ กำลังพาไปหน้า Login...");
      setTimeout(() => router.push("/login"), 1200);
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
          <h1 className="mb-1 text-xl font-semibold">ตั้งรหัสผ่านใหม่</h1>

          {!token && (
            <div className="mb-4 rounded-lg border p-3 text-sm text-destructive">
              ไม่พบ token ในลิงก์ กรุณาขอรีเซ็ตรหัสผ่านใหม่
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">รหัสผ่านใหม่</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-foreground/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">ยืนยันรหัสผ่าน</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-foreground/20"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
              />
            </div>

            {msg && <div className="text-sm">{msg}</div>}
            {err && <div className="text-sm text-destructive">{err}</div>}

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </button>

            <div className="flex justify-center gap-4 text-sm">
              <Link href="/forgot-password" className="underline underline-offset-4 hover:opacity-80">
                ขอ link ใหม่
              </Link>
              <Link href="/login" className="underline underline-offset-4 hover:opacity-80">
                ไปหน้า Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
