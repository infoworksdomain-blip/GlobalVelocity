"use client";
import { useEffect, useState } from "react";
export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem("velocity.cookies")) setShow(true); } catch {} }, []);
  if (!show) return null;
  const set = (v: string) => { localStorage.setItem("velocity.cookies", v); setShow(false); };
  return <div className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md z-50 card p-4 text-sm shadow-lg"><p>We use essential cookies to run the app and, with your consent, analytics cookies to improve it. <a className="underline" href="/privacy">Privacy policy</a></p><div className="mt-3 flex gap-2"><button className="btn-primary" onClick={() => set("all")}>Accept all</button><button className="btn-secondary" onClick={() => set("essential")}>Essential only</button></div></div>;
}
