"use client";
import { useState } from "react";

/** Shared time-of-day chip picker + weekday grid, extracted from Automations so GhostMode's wizard can reuse the exact same cadence UI. */
export function SchedulePicker({ times, weekdays, onTimesChange, onWeekdaysChange }: { times: string[]; weekdays: number[]; onTimesChange: (times: string[]) => void; onWeekdaysChange: (weekdays: number[]) => void }) {
  const [newTime, setNewTime] = useState("09:00");
  const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); const d = new Date(); d.setHours(h, m); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
  const addTime = () => { if (!newTime || times.includes(newTime)) return; onTimesChange([...times, newTime].sort()); };
  const removeTime = (t: string) => onTimesChange(times.filter((x) => x !== t));
  return (
    <>
      <div>
        <label className="label">Times (workspace timezone)</label>
        <div className="flex flex-wrap gap-1.5 mb-2">{times.map((t) => <span key={t} className="badge px-2.5 py-1 bg-brand-50 text-brand-700 flex items-center gap-1.5">{fmtTime(t)}<button type="button" className="text-brand-400 hover:text-brand-700" onClick={() => removeTime(t)}>✕</button></span>)}{times.length === 0 && <span className="text-xs text-slate-400">No times selected yet</span>}</div>
        <div className="flex gap-2"><input type="time" className="input" value={newTime} onChange={(e) => setNewTime(e.target.value)} /><button type="button" className="btn-secondary" onClick={addTime}>+ Add time</button></div>
      </div>
      <div>
        <label className="label">Weekdays</label>
        <div className="flex gap-1">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <button key={i} type="button" onClick={() => onWeekdaysChange(weekdays.includes(i) ? weekdays.filter((x) => x !== i) : [...weekdays, i])} className={`h-8 w-8 rounded-lg ${weekdays.includes(i) ? "bg-brand-600 text-white" : "bg-slate-100"}`}>{d}</button>)}</div>
      </div>
    </>
  );
}
