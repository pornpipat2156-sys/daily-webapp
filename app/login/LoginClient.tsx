"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginClient() {
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
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-7xl items-start justify-center px-3 pt-16 sm:px-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold">Login</h1>
          <p className="mb-4 text-sm text-muted-foreground"> </p>

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

            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input
                className="w-full rounded-lg border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-foreground/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
