"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { api } from "@/lib/api";
import { useAction, Spinner } from "@/components/ui";
type Job = { id: string; status: string; progress: { step: string; pct: number }; error?: string | null };
export default function Onboarding() {
  const { workspaceId } = useMe(); const router = useRouter(); const { run, busy, wall } = useAction();
  const [url, setUrl] = useState(""); const [job, setJob] = useState<Job | null>(null);
  useEffect(() => { if (!job || ["done", "failed"].includes(job.status)) return; const t = setTimeout(() => api<{ job: Job }>(`/jobs/${job.id}`).then((r) => setJob(r.job)), 1500); return () => clearTimeout(t); }, [job]);
  useEffect(() => { if (job?.status === "done") setTimeout(() => router.push("/app/velocity?fresh=1"), 800); }, [job, router]);
  const start = () => run(async () => { const r = await api<{ job_id: string }>(`/workspaces/${workspaceId}/profile`, { method: "POST", json: { url } }); setJob({ id: r.job_id, status: "queued", progress: { step: "Queued", pct: 0 } }); });
  return (
    <div className="mx-auto max-w-xl py-12">{wall}
      <h1 className="text-3xl font-extrabold">Let's build your Company Profile</h1>
      <p className="mt-2 text-slate-600">Paste your website URL. We'll read your site, understand your audience and generate your first 30 posts.</p>
      {!job ? (
        <div className="mt-8 flex gap-2"><input className="input" placeholder="https://yourproduct.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && start()} autoFocus /><button className="btn-primary whitespace-nowrap" onClick={start} disabled={busy || url.length < 4}>{busy ? <Spinner /> : "Analyse"}</button></div>
      ) : (
        <div className="card mt-8 p-6">
          <div className="flex items-center gap-3">{job.status !== "failed" && job.status !== "done" && <Spinner />}<div className="font-semibold">{job.status === "failed" ? "Analysis failed" : job.progress.step}</div></div>
          <div className="mt-3 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-600 transition-all" style={{ width: `${job.status === "done" ? 100 : job.progress.pct}%` }} /></div>
          {job.status === "failed" && <div className="mt-3 text-sm text-red-600">{job.error ?? "Try another URL, or build the profile manually in Settings → Profile."}<button className="btn-secondary mt-3" onClick={() => setJob(null)}>Try again</button></div>}
          {job.status === "done" && <div className="mt-3 text-sm text-emerald-700">Done — opening Velocity mode…</div>}
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500">No website yet? <a className="underline" href="/app/settings/profile">Fill the profile manually</a>.</p>
    </div>
  );
}
