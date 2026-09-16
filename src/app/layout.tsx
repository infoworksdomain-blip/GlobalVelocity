import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
const base = process.env.APP_URL ?? "http://localhost:3000";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", weight: ["500", "600", "700"], display: "swap" });
export const metadata: Metadata = {
  title: { default: "Velocity — AI marketing on autopilot for founders", template: "%s · Velocity" },
  description: "Paste your website URL, get a month of TikToks, Reels, Shorts and LinkedIn posts, swipe to approve, and let Velocity schedule and publish them.",
  metadataBase: new URL(base),
  applicationName: "Velocity", keywords: ["AI UGC generator", "short-form video", "TikTok scheduler", "Instagram Reels", "YouTube Shorts", "LinkedIn video", "content automation", "AI marketing"],
  openGraph: { type: "website", siteName: "Velocity", images: [{ url: `${base}/api/og?title=AI%20marketing%20on%20autopilot`, width: 1200, height: 630, alt: "Velocity — AI marketing on autopilot" }] },
  twitter: { card: "summary_large_image", site: "@velocityhq" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: { icon: "/icon.svg" },
};
// Runs before first paint to avoid a flash of the wrong theme: applies a saved explicit choice
// immediately; if none was ever saved, the CSS media-query default (dark, or light on a light-preferring
// system) applies with no JS needed.
const THEME_INIT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT }} /></head>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
