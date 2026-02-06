import { Suspense } from "react";
import ForgotPasswordClient from "./ForgotPasswordClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ForgotPasswordClient />
    </Suspense>
  );
}
