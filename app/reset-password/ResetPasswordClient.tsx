"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function ResetPasswordClient() {
  const params = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => (params.get("token") || "").trim(), [params]);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

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
        headers: { "Content-Type": "application/json" },
        // ✅ ต้องเป็น newPassword เท่านั้น
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
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-7xl items-start justify-center px-3 pt-16 sm:px-6">
        <div className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold">ตั้งรหัสผ่านใหม่</h1>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">รหัสผ่านใหม่</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-foreground/20"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                required
                autoComplete="new-password"
                placeholder="อย่างน้อย 8 ตัวอักษร"
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

            {msg && <div className="text-sm text-muted-foreground">{msg}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </button>

            <div className="flex items-center justify-center gap-4 pt-1 text-sm">
              <a className="underline opacity-80 hover:opacity-100" href="/forgot-password">
                ขอ link ใหม่
              </a>
              <a className="underline opacity-80 hover:opacity-100" href="/login">
                ไปหน้า Login
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
