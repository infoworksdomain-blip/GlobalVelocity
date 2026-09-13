"use client";
import { useState } from "react";
import { Link2, Check } from "lucide-react";
/** Social sharing row: X, LinkedIn, Facebook, WhatsApp, email and copy link. */
export function ShareRow({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "");
  const url = base + path; const t = encodeURIComponent(title); const u = encodeURIComponent(url);
  const links: [string, string][] = [["X", `https://twitter.com/intent/tweet?text=${t}&url=${u}`], ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`], ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`], ["WhatsApp", `https://wa.me/?text=${t}%20${u}`], ["Email", `mailto:?subject=${t}&body=${u}`]];
  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-6">
      <span className="text-sm font-semibold text-slate-500 mr-1">Share</span>
      {links.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer noopener" className="btn-secondary px-3 py-1.5 text-xs" aria-label={`Share on ${label}`}>{label}</a>)}
      <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }} aria-label="Copy link">{copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Link2 className="h-3.5 w-3.5" />Copy link</>}</button>
    </div>
  );
}
