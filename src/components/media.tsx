"use client";
import { useState } from "react";
import { FORMAT_LABEL } from "@/lib/api";
export type Item = { id: string; format: string; status: string; hook: string | null; script: string | null; caption: string | null; hashtags: string[]; on_screen_text: string[]; predicted_score: number | null; character?: { name: string } | null; media: { video_url: string | null; image_urls: (string | null)[]; thumbnail_url: string | null; duration_ms?: number }; created_at: string };
/** 9:16 media preview: video with poster, or image carousel for slideshows/memes. */
export function MediaPreview({ item, className = "", autoPlay = false }: { item: Item; className?: string; autoPlay?: boolean }) {
  const [idx, setIdx] = useState(0); const imgs = item.media.image_urls.filter(Boolean) as string[];
  if (item.media.video_url) return <video key={item.media.video_url} src={item.media.video_url} poster={item.media.thumbnail_url ?? undefined} className={`aspect-[9/16] w-full rounded-2xl bg-black object-cover ${className}`} controls={!autoPlay} autoPlay={autoPlay} muted={autoPlay} loop playsInline />;
  if (imgs.length) return <div className={`relative aspect-[9/16] w-full rounded-2xl bg-black overflow-hidden ${className}`} onClick={() => setIdx((idx + 1) % imgs.length)}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={imgs[idx]} alt={item.hook ? `${FORMAT_LABEL[item.format] ?? "Content"}: ${item.hook}` : "Generated content preview"} className="h-full w-full object-cover" />{imgs.length > 1 && <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">{imgs.map((_, i) => <span key={i} className={`h-1.5 w-4 rounded ${i === idx ? "bg-white" : "bg-white/40"}`} />)}</div>}</div>;
  return <div className={`aspect-[9/16] w-full rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-6 text-white flex items-end ${className}`}><p className="text-2xl font-extrabold">{item.hook ?? "Rendering…"}</p></div>;
}
