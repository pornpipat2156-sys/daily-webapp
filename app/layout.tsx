// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "./globals.css";

import Providers from "./providers";
import AppShell from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DAILY-WEBAPP",
  description: "Daily report web application",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "DAILY-WEBAPP",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[radial-gradient(circle_at_top_left,_rgba(190,227,255,0.22),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(240,210,255,0.18),_transparent_24%),linear-gradient(180deg,_#fcfdff_0%,_#f7f9fc_52%,_#f4f7fb_100%)] text-slate-800`}
      >
        <div className="min-h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.64))]">
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </div>

        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", function () {
                navigator.serviceWorker.register("/sw.js").catch(function (err) {
                  console.error("SW register failed:", err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}