"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const params = useSearchParams();
  const from = params.get("from") || "/daily-report";
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("user123");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: from,
    });

    if ((res as any)?.error) setError("Login ไม่สำเร็จ (email/password ไม่ถูกต้อง)");
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Login</h1>
      <p className="mb-4 text-sm opacity-70">Demo accounts ตาม .env.local</p>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm">Email</label>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm">Password</label>
          <input
            className="w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button className="w-full rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90">
          Sign in
        </button>
      </form>
    </div>
  );
}
