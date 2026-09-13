import { ImageResponse } from "next/og";
/** Generated Open Graph / Twitter card image: /api/og?title=… */
export const runtime = "nodejs";
export function GET(req: Request) {
  const title = new URL(req.url).searchParams.get("title")?.slice(0, 120) ?? "AI marketing on autopilot";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0b1a4b 0%,#2947d6 60%,#10b981 160%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 800 }}><div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>⚡</div>Velocity</div>
        <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.08, maxWidth: 960 }}>{title}</div>
        <div style={{ fontSize: 28, opacity: 0.8 }}>Paste a URL → a month of TikToks, Reels, Shorts &amp; LinkedIn posts</div>
      </div>
    ), { width: 1200, height: 630 }
  );
}
