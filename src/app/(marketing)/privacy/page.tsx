import Link from "next/link";
import { APP } from "@/content/site";
import { pageMeta } from "@/lib/seo";
const A = APP.address;
export const metadata = pageMeta({ title: "Privacy policy", description: `How ${APP.name} collects, uses, stores and deletes personal data, which sub-processors we use, how long we retain information, and how to exercise your data rights.`, path: "/privacy" });
const S: [string, React.ReactNode][] = [
  ["Who we are", <>{APP.name} is operated from {A.line1}, {A.city}, {A.region} {A.postcode}, {A.country}. For any privacy question, or to exercise the rights below, email <a className="underline" href={`mailto:${A.email}`}>{A.email}</a>.</>],
  ["What we collect", <>Account data (name, email, workspace and team membership); content data (the website URL you submit, the Company Profile generated from it, brand assets you upload and the content we generate); connection data (encrypted access tokens for social accounts you connect); usage data (feature usage, audit events, credit ledger); billing data held by Stripe (we store only a customer id and plan state, never card numbers); and, if you install the tracking snippet, visitor events on your own website.</>],
  ["How we use it", <>To provide the service (analyse your site, generate content, schedule and publish posts, report analytics), to enforce plan limits, to bill you, to send transactional email such as magic links and failure notices, and to keep the service secure. We do not sell personal data and we do not use your content to train third-party models beyond the processing needed to generate your own output.</>],
  ["Legal bases", <>Performance of a contract (providing the service), legitimate interests (security, product improvement, fraud prevention), consent (analytics cookies and marketing email) and legal obligation (tax and accounting records).</>],
  ["Sub-processors", <>Hosting and database providers; an LLM provider for copywriting; optional speech, video and image generation providers; Stripe for payments; an email provider for transactional mail; and the social platforms you choose to connect. Each receives only the data needed for its function.</>],
  ["Retention", <>Content and profiles are kept while your account is active. Deleting your account marks it for purge after 30 days. Skipped content is archived after 30 days. Website tracking events are retained for 13 months by default. Audit logs are retained for 24 months.</>],
  ["Security", <>Social tokens are encrypted at rest with AES-256-GCM; API keys are stored as hashes and shown once. Access is scoped per account and workspace, all traffic is served over TLS, and administrative actions are written to an audit log.</>],
  ["Your rights", <>You can access, correct, export or delete your data, object to or restrict processing, and withdraw consent at any time. Most of this is self-service in the app; anything else, email us and we will respond within 30 days. You may also complain to your local supervisory authority (in the UK, the ICO).</>],
  ["Cookies", <>We use strictly necessary cookies for sign-in and workspace selection. Analytics cookies are set only if you accept them in the banner, and you can change your mind at any time by clearing site data.</>],
  ["International transfers", <>Where data is processed outside your region, we rely on standard contractual clauses or an adequacy decision with the relevant provider.</>],
  ["Children", <>The service is not directed at anyone under 16 and we do not knowingly collect their data.</>],
  ["Changes", <>We will post material changes on this page and, where the change is significant, notify you by email before it takes effect.</>],
];
export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <span className="eyebrow">Legal</span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">This policy is a thorough starting point written for this product, not legal advice. Have your counsel review it, and confirm the sub-processor list matches the providers you actually enable, before launch.</div>
      <nav className="mt-8 card p-5" aria-label="Sections"><div className="label">On this page</div><ol className="mt-1 grid gap-1 sm:grid-cols-2 text-sm">{S.map(([h], i) => <li key={h}><a className="text-brand-700 hover:underline" href={`#s${i}`}>{i + 1}. {h}</a></li>)}</ol></nav>
      {S.map(([h, body], i) => <section key={h} id={`s${i}`} className="mt-8 scroll-mt-20"><h2 className="text-xl font-bold">{i + 1}. {h}</h2><p className="mt-2 text-slate-700 leading-relaxed">{body}</p></section>)}
      <p className="mt-10 text-sm text-slate-600">See also our <Link className="underline" href="/terms">terms of service</Link> and <Link className="underline" href="/faq#privacy---data">privacy FAQs</Link>.</p>
    </div>
  );
}
