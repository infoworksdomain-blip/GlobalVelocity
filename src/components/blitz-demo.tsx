"use client";
import { useState } from "react";
const CARDS = [
  { hook: "I stopped doing marketing manually", format: "AI UGC", color: "from-brand-600 to-brand-900" },
  { hook: "3 things I wish I knew before launching", format: "Slideshow", color: "from-fuchsia-600 to-purple-900" },
  { hook: "POV: your calendar fills itself", format: "Hook + demo", color: "from-emerald-500 to-teal-900" },
  { hook: "Me: I'll post tomorrow", format: "Meme", color: "from-amber-500 to-orange-800" },
];
/** Interactive landing-page Blitz mock (FR-1.1) — no backend, purely illustrative. */
export function BlitzDemo() {
  const [i, setI] = useState(0); const [dir, setDir] = useState<"l" | "r" | null>(null); const [kept, setKept] = useState(0);
  const swipe = (d: "l" | "r") => { setDir(d); setTimeout(() => { setDir(null); setI((x) => (x + 1) % CARDS.length); if (d === "r") setKept((k) => k + 1); }, 350); };
  const c = CARDS[i], next = CARDS[(i + 1) % CARDS.length];
  return (
    <div className="relative mx-auto w-[280px] h-[520px] select-none">
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${next.color} scale-95 translate-y-3 opacity-60`} />
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${c.color} p-6 flex flex-col justify-between text-white shadow-2xl ${dir === "r" ? "swipe-right" : dir === "l" ? "swipe-left" : ""}`}>
        <div className="badge bg-white/20 text-white self-start">{c.format}</div>
        <div><p className="text-3xl font-extrabold leading-tight">{c.hook}</p><p className="mt-3 text-white/70 text-sm">Generated from your website in mock preview.</p></div>
        <div className="flex justify-between">
          <button onClick={() => swipe("l")} className="h-14 w-14 rounded-full bg-white/15 text-2xl hover:bg-white/25">✕</button>
          <button onClick={() => swipe("r")} className="h-14 w-14 rounded-full bg-white text-brand-700 text-2xl font-bold hover:scale-105 transition">♥</button>
        </div>
      </div>
      <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-slate-500">Try it: swipe right to keep · {kept} kept</div>
    </div>
  );
}
