import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center px-4 py-8">
      <div className="soft-card w-full max-w-md rounded-[28px] px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
        กำลังโหลด...
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}