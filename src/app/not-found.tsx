import Link from "next/link";
import { Zap, Home, Search, LifeBuoy } from "lucide-react";
export const metadata = { title: "Page not found", description: "The page you were looking for doesn't exist or has moved." };
export default function NotFound() {
  return (
    <div className="min-h-screen hero-bg grid place-items-center px-4">
      <div className="text-center max-w-lg">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white"><Zap className="h-6 w-6" /></div>
        <p className="mt-6 eyebrow">404</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">This page took a wrong turn.</h1>
        <p className="mt-3 text-slate-600">The link may be out of date, or the page may have moved. Here are a few places that usually help.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3 text-sm">
          <Link href="/" className="card card-hover p-4"><Home className="mx-auto h-5 w-5 text-brand-600" /><div className="mt-2 font-semibold">Home</div></Link>
          <Link href="/faq" className="card card-hover p-4"><Search className="mx-auto h-5 w-5 text-brand-600" /><div className="mt-2 font-semibold">FAQ</div></Link>
          <Link href="/contact" className="card card-hover p-4"><LifeBuoy className="mx-auto h-5 w-5 text-brand-600" /><div className="mt-2 font-semibold">Contact</div></Link>
        </div>
        <p className="mt-8 text-xs text-slate-500">Popular: <Link className="underline" href="/pricing">Pricing</Link> · <Link className="underline" href="/tools/ai-ugc-video-generator">AI UGC generator</Link> · <Link className="underline" href="/blog">Blog</Link> · <Link className="underline" href="/app">Open the app</Link></p>
      </div>
    </div>
  );
}
