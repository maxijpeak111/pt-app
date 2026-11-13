import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import BottomNav, { NavBar } from "@/components/BottomNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PT",
  description: "My personal training planner and session log.",
  // iPhone-specific settings for when the app is added to the home screen
  appleWebApp: {
    capable: true,
    title: "PT",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // lets the app draw behind the iPhone notch / home bar
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body className="min-h-dvh bg-ink text-white">
        {/* Solid strip behind the iPhone status bar so content doesn't scroll under the clock */}
        <div aria-hidden className="fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top)] bg-ink" />
        <main className="mx-auto w-full max-w-md px-5 pt-safe pb-nav">{children}</main>
        <Suspense fallback={<NavBar pathname={null} />}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
