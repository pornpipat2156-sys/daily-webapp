import { Suspense } from "react";

import PreviewClient from "./PreviewClient";

function PreviewFallback() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 px-3 py-3 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100 sm:px-4 sm:py-4">
      <section className="overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(135deg,rgba(240,244,255,0.96),rgba(236,249,245,0.9),rgba(255,244,246,0.92))] p-5 shadow-[0_18px_50px_rgba(148,163,184,0.16)] backdrop-blur dark:border-slate-800/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(30,41,59,0.96))] dark:shadow-[0_20px_60px_rgba(2,6,23,0.45)] sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400 dark:text-slate-500">
          Preview
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Daily report preview
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Loading preview...
        </p>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PreviewFallback />}>
      <PreviewClient />
    </Suspense>
  );
}