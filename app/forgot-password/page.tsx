"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!email.trim()) {
      setErr("กรุณากรอกอีเมล");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // บางที API ของคุณอาจส่ง empty body (เคยเห็น 500 length 0)
      const text = await res.text().catch(() => "");
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {}

      if (!res.ok) {
        setErr(data?.message || `ส่งไม่สำเร็จ (HTTP ${res.status})`);
      } else {
        setMsg(
          "ถ้าอีเมลนี้ได้รับอนุญาต ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่าน/เปลี่ยนรหัสผ่านไปให้แล้ว (โปรดเช็ค Inbox/Spam)"
        );
      }
    } catch (e: any) {
      setErr(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">ลืมรหัสผ่าน</h1>
      <p className="mt-2 text-sm opacity-80">
        กรอกอีเมลที่ใช้เข้าระบบ แล้วเราจะส่งลิงก์ไปให้ตั้งรหัสผ่านใหม่
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label className="block text-sm">
          อีเมล
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
          />
        </label>

        {err && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm">
            {err}
          </div>
        )}
        {msg && (
          <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm">
            {msg}
          </div>
        )}

        <button
          disabled={loading}
          className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
          type="submit"
        >
          {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
        </button>

        <div className="text-center text-sm">
          <Link className="underline underline-offset-4" href="/login">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </form>
    </div>
  );
}
