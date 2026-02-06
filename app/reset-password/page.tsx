import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
