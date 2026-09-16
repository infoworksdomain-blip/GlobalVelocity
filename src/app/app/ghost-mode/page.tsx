"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery as useConvexQuery } from "convex/react";
import { api as convexApi } from "@convex/_generated/api";
import { useMe } from "@/lib/use-me";
import { api, PLATFORM_LABEL } from "@/lib/api";
import { useAction, Spinner, Badge } from "@/components/ui";
import { SchedulePicker } from "@/components/schedule-picker";

type Job = { id: string; status: string; progress: { step: string; pct: number }; error?: string | null; result?: { profileId: string; niche_match: NicheMatch } | null };
type NicheMatch = { matched_categories: string[]; suggested_style_tags: string[]; confidence: number; rationale: string };
type Clip = { id: string; thumbnailUrl: string | null; category: string | null; styleTags: string[] };
type Social = { id: string; platform: string; handle: string | null; status: string };
type Auto = { id: string; name: string; kind?: string; status: string; lastRunAt: string | null; config: { posts_per_day: number; social_account_ids: string[] } };
type Preview = { slots: number; will_generate: number; library_clips_available: number | null; warnings: string[] };

const DEFAULT_CADENCE = { posts_per_day: 1, horizon_days: 14, times: ["09:00", "18:00"], weekdays: [1, 2, 3, 4, 5] };

/** GhostMode (M-GM): scan a business's website, match it to the UGC library's niche taxonomy, then
 * autoschedule + autopublish from that niche (or AI-generate instead). Reuses the existing profile-scan,
 * UGC library, and automations engine wholesale -- this page is the guided setup wizard over them. */
export default function GhostMode() {
  const { workspaceId } = useMe(); const router = useRouter(); const { run, busy, wall } = useAction();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<Auto | null>(null);
  const [existingPreview, setExistingPreview] = useState<Preview | null>(null);

  const [step, setStep] = useState<"scan" | "niche" | "cadence" | "accounts" | "confirm">("scan");
  const [url, setUrl] = useState(""); const [job, setJob] = useState<Job | null>(null);
  const [source, setSource] = useState<"library" | "generate" | "mixed">("library");
  const [categories, setCategories] = useState<string[]>([]); const [styleTags, setStyleTags] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [sample, setSample] = useState<Clip[]>([]);
  const [cadence, setCadence] = useState(DEFAULT_CADENCE);
  const [socials, setSocials] = useState<Social[]>([]); const [accountIds, setAccountIds] = useState<string[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      api<{ automations: Auto[] }>(`/workspaces/${workspaceId}/automations`),
      api<{ socials: Social[] }>(`/workspaces/${workspaceId}/socials`),
      api<{ categories: string[] }>(`/ugc-clips/categories`),
    ]).then(async ([a, s, c]) => {
      setSocials(s.socials.filter((x) => x.status === "active"));
      setAvailableCategories(c.categories);
      const gm = a.automations.find((x) => x.kind === "ghost_mode") ?? null;
      setExisting(gm);
      if (gm) setExistingPreview(await api<Preview>(`/automations/${gm.id}/preview`, { method: "POST" }));
      setLoading(false);
    });
  }, [workspaceId]);

  // Live scan progress: Convex if configured (no poll delay), else the same polling pattern as
  // /app/onboarding. Strictly opt-in -- the wizard works identically either way.
  const useConvex = !!process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexProgress = useConvexQuery(convexApi.ghostMode.getByJobId, useConvex && job && !["done", "failed"].includes(job.status) ? { jobId: job.id } : "skip");
  useEffect(() => {
    if (!convexProgress || !job) return;
    setJob({ id: job.id, status: convexProgress.status, progress: { step: convexProgress.step, pct: convexProgress.pct }, error: convexProgress.error ?? null, result: convexProgress.nicheMatch ? { profileId: "", niche_match: convexProgress.nicheMatch as NicheMatch } : job.result });
  }, [convexProgress, job]);
  useEffect(() => {
    if (useConvex || !job || ["done", "failed"].includes(job.status)) return;
    const t = setTimeout(() => api<{ job: Job }>(`/jobs/${job.id}`).then((r) => setJob(r.job)), 1500);
    return () => clearTimeout(t);
  }, [job, useConvex]);
  const selectNiche = useCallback((category: string) => {
    setCategories(category ? [category] : []);
    if (category) api<{ clips: Clip[] }>(`/ugc-clips?category=${encodeURIComponent(category)}`).then((r) => setSample(r.clips.slice(0, 8)));
    else setSample([]);
  }, []);

  useEffect(() => {
    if (job?.status !== "done" || !job.result) return;
    const nm = job.result.niche_match;
    setStyleTags(nm.suggested_style_tags);
    const top = nm.matched_categories.find((c) => availableCategories.includes(c)) ?? "";
    selectNiche(top);
    setSource(top ? "library" : "generate");
    setStep("niche");
  }, [job, availableCategories, selectNiche]);

  const startScan = () => run(async () => { const r = await api<{ job_id: string }>(`/workspaces/${workspaceId}/profile`, { method: "POST", json: { url, skip_first_batch: true } }); setJob({ id: r.job_id, status: "queued", progress: { step: "Queued", pct: 0 } }); });

  const create = () => run(async () => {
    const formatMix = source === "library" ? { human_ugc: 1 } : source === "generate" ? { ai_ugc: 0.5, slideshow: 0.3, hook_demo: 0.2 } : { human_ugc: 0.6, ai_ugc: 0.4 };
    const a = await api<{ automation: Auto }>(`/workspaces/${workspaceId}/automations`, {
      method: "POST", json: {
        name: "Ghost Mode", mode: "continuous", approval: "calendar", kind: "ghost_mode",
        config: { social_account_ids: accountIds, posts_per_day: cadence.posts_per_day, horizon_days: cadence.horizon_days, times: cadence.times, weekdays: cadence.weekdays, format_mix: formatMix, source, ugc_categories: categories, ugc_style_tags: styleTags, min_spacing_minutes: 120, max_per_platform_per_day: 3 },
      },
    });
    await api(`/automations/${a.automation.id}/run`, { method: "POST" });
    router.push("/app/calendar");
  }, "Ghost Mode is live — check Calendar in a minute");

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  if (loading) return <div className="py-20 grid place-items-center"><Spinner /></div>;

  if (existing) {
    return (
      <div className="mx-auto max-w-xl py-12">{wall}
        <div className="flex items-center gap-2"><h1 className="text-2xl font-extrabold">Ghost Mode</h1><Badge tone="brand">{existing.status}</Badge></div>
        <p className="mt-2 text-slate-600">Running on autopilot: {existing.config.posts_per_day}/day across {existing.config.social_account_ids.length} account(s). Last run {existing.lastRunAt ? new Date(existing.lastRunAt).toLocaleString() : "not yet"}.</p>
        {existingPreview && <p className="mt-2 text-sm text-slate-500">{existingPreview.slots} posts scheduled this cycle{existingPreview.library_clips_available !== null ? ` · ${existingPreview.library_clips_available} matching clips in the library` : ""}.</p>}
        <div className="mt-6 flex gap-2"><a className="btn-secondary" href="/app/calendar">Open Calendar</a><a className="btn-secondary" href="/app/automations">Manage in Automations</a></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-12">{wall}
      <h1 className="text-2xl font-extrabold">Ghost Mode</h1>
      <p className="mt-2 text-slate-600">Scan your website, match your niche to the video library, and let Ghost Mode post for you on autopilot.</p>

      {step === "scan" && (
        !job ? (
          <div className="mt-8 flex gap-2"><input className="input" placeholder="https://yourbusiness.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startScan()} autoFocus /><button className="btn-primary whitespace-nowrap" onClick={startScan} disabled={busy || url.length < 4}>{busy ? <Spinner /> : "Scan site"}</button></div>
        ) : (
          <div className="card mt-8 p-6">
            <div className="flex items-center gap-3">{job.status !== "failed" && job.status !== "done" && <Spinner />}<div className="font-semibold">{job.status === "failed" ? "Scan failed" : job.progress.step}</div></div>
            <div className="mt-3 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-600 transition-all" style={{ width: `${job.status === "done" ? 100 : job.progress.pct}%` }} /></div>
            {job.status === "failed" && <div className="mt-3 text-sm text-red-600">{job.error ?? "Try another URL."}<button className="btn-secondary mt-3" onClick={() => setJob(null)}>Try again</button></div>}
          </div>
        )
      )}

      {step === "niche" && (
        <div className="mt-8 space-y-4 text-sm">
          <div className="flex gap-2"><button className={`btn-secondary flex-1 ${source !== "generate" ? "ring-2 ring-brand-500" : ""}`} onClick={() => setSource(categories.length ? "library" : "mixed")}>Use video library</button><button className={`btn-secondary flex-1 ${source === "generate" ? "ring-2 ring-brand-500" : ""}`} onClick={() => setSource("generate")}>AI-generate instead</button></div>
          {source !== "generate" && <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Niche ({availableCategories.length} in library)</label>
                {availableCategories.length > 0 ? (
                  <select className="input" value={categories[0] ?? ""} onChange={(e) => selectNiche(e.target.value)}>
                    <option value="">Select a niche…</option>
                    {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : <p className="text-xs text-slate-400 py-2.5">No niches in the library yet — switch to AI-generate.</p>}
              </div>
              <div><label className="label">Style tags</label><input className="input" value={styleTags.join(",")} onChange={(e) => setStyleTags(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></div>
            </div>
            {sample.length > 0 && <div><label className="label">Sample clips</label><div className="grid grid-cols-4 gap-2">{sample.map((c) => c.thumbnailUrl && <img key={c.id} src={c.thumbnailUrl} className="rounded-lg aspect-[9/16] object-cover" alt="" />)}</div></div>}
            {sample.length === 0 && categories.length > 0 && <p className="text-xs text-slate-400">No sample clips found for this niche yet — you can still continue, or switch to AI-generate.</p>}
          </>}
          <div className="flex justify-end"><button className="btn-primary" onClick={() => setStep("cadence")}>Continue</button></div>
        </div>
      )}

      {step === "cadence" && (
        <div className="mt-8 space-y-4 text-sm">
          <div><label className="label">Posts per day (per account)</label><input type="number" min={1} max={10} className="input" value={cadence.posts_per_day} onChange={(e) => setCadence({ ...cadence, posts_per_day: Number(e.target.value) })} /></div>
          <SchedulePicker times={cadence.times} weekdays={cadence.weekdays} onTimesChange={(times) => setCadence({ ...cadence, times })} onWeekdaysChange={(weekdays) => setCadence({ ...cadence, weekdays })} />
          <div className="flex justify-between"><button className="btn-ghost" onClick={() => setStep("niche")}>Back</button><button className="btn-primary" onClick={() => setStep("accounts")}>Continue</button></div>
        </div>
      )}

      {step === "accounts" && (
        <div className="mt-8 space-y-4 text-sm">
          <label className="label">Accounts to post to</label>
          <div className="flex flex-wrap gap-2">{socials.map((s) => <button key={s.id} onClick={() => toggle(accountIds, setAccountIds, s.id)} className={`badge px-3 py-1.5 ${accountIds.includes(s.id) ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{PLATFORM_LABEL[s.platform]} @{s.handle}</button>)}{socials.length === 0 && <span className="text-slate-500">Connect a social account first in Settings.</span>}</div>
          <div className="flex justify-between"><button className="btn-ghost" onClick={() => setStep("cadence")}>Back</button><button className="btn-primary" disabled={accountIds.length === 0} onClick={() => setStep("confirm")}>Continue</button></div>
        </div>
      )}

      {step === "confirm" && (
        <div className="mt-8 space-y-3 text-sm">
          <div className="card p-4 space-y-1">
            <p><b>{cadence.posts_per_day}</b>/day across <b>{accountIds.length}</b> account(s)</p>
            <p>Source: <b>{source === "library" ? "video library" : source === "generate" ? "AI-generated" : "library + AI mix"}</b>{categories.length > 0 && source !== "generate" ? ` — ${categories.join(", ")}` : ""}</p>
          </div>
          <div className="flex justify-between"><button className="btn-ghost" onClick={() => setStep("accounts")}>Back</button><button className="btn-primary" disabled={busy} onClick={create}>{busy ? <Spinner /> : "Turn on Ghost Mode"}</button></div>
        </div>
      )}
    </div>
  );
}
