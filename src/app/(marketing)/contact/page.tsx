import Link from "next/link";
import { MapPin, Phone, Mail, Clock, Navigation, Train, Car } from "lucide-react";
import { APP } from "@/content/site";
import { ShareRow } from "@/components/share";
import { pageMeta } from "@/lib/seo";
const A = APP.address;
const full = `${A.line1}, ${A.line2}, ${A.city}, ${A.region} ${A.postcode}, ${A.country}`;
export const metadata = pageMeta({ title: "Contact us — address, map and directions", description: `Get in touch with the ${APP.name} team. Office address in ${A.city}, ${A.region}, opening hours, phone, email, map and travel directions.`, path: "/contact" });
export default function Contact() {
  const q = encodeURIComponent(full);
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${A.lng - 0.012}%2C${A.lat - 0.006}%2C${A.lng + 0.012}%2C${A.lat + 0.006}&layer=mapnik&marker=${A.lat}%2C${A.lng}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "Organization", name: APP.name, url: process.env.APP_URL, email: A.email, telephone: A.phone, address: { "@type": "PostalAddress", streetAddress: `${A.line1}, ${A.line2}`, addressLocality: A.city, addressRegion: A.region, postalCode: A.postcode, addressCountry: "GB" }, geo: { "@type": "GeoCoordinates", latitude: A.lat, longitude: A.lng }, openingHours: "Mo-Fr 09:00-17:30" };
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <span className="eyebrow">Contact</span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Talk to a human</h1>
      <p className="mt-3 text-lg text-slate-600 max-w-2xl">Sales, partnerships and support. We reply within one business day. For quick answers, try the <Link className="text-brand-700 underline" href="/faq">FAQ</Link> or the <Link className="text-brand-700 underline" href="/developers">API docs</Link>.</p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <h2 className="font-bold text-lg">Our office</h2>
            <address className="not-italic space-y-3 text-sm">
              <div className="flex gap-3"><MapPin className="h-4.5 w-4.5 text-brand-600 shrink-0" aria-hidden /><span>{A.line1}<br />{A.line2}<br />{A.city}, {A.region} {A.postcode}<br />{A.country}</span></div>
              <div className="flex gap-3"><Phone className="h-4 w-4 text-brand-600 shrink-0" aria-hidden /><a className="hover:underline" href={`tel:${A.phone.replace(/\s/g, "")}`}>{A.phone}</a></div>
              <div className="flex gap-3"><Mail className="h-4 w-4 text-brand-600 shrink-0" aria-hidden /><a className="hover:underline" href={`mailto:${A.email}`}>{A.email}</a></div>
              <div className="flex gap-3"><Clock className="h-4 w-4 text-brand-600 shrink-0" aria-hidden /><span>{A.hours}</span></div>
            </address>
            <div className="flex flex-wrap gap-2 pt-1">
              <a className="btn-primary" href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" />Get directions</a>
              <a className="btn-secondary" href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
              <a className="btn-secondary" href={`https://maps.apple.com/?daddr=${q}`} target="_blank" rel="noreferrer">Apple Maps</a>
            </div>
          </div>
          <div className="card p-6">
            <h2 className="font-bold text-lg">Getting here</h2>
            <ul className="mt-3 space-y-3 text-sm text-slate-600">
              <li className="flex gap-3"><Train className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" aria-hidden /><span><b className="text-slate-900">By train</b><br />Aylesham station is a 10-minute walk: turn right onto Station Road, left at the roundabout, and the business park is 300m on your right.</span></li>
              <li className="flex gap-3"><Car className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" aria-hidden /><span><b className="text-slate-900">By car</b><br />From the A2, take the Aylesham exit and follow signs for the business park. Free visitor parking is available on site; use postcode {A.postcode} for sat-nav.</span></li>
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <iframe title={`Map showing the ${APP.name} office at ${full}`} src={embed} className="w-full h-[380px] border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
            <div className="px-4 py-3 text-xs text-slate-500 flex justify-between"><span>{full}</span><a className="text-brand-700 underline" href={`https://www.openstreetmap.org/?mlat=${A.lat}&mlon=${A.lng}#map=16/${A.lat}/${A.lng}`} target="_blank" rel="noreferrer">Larger map</a></div>
          </div>
          <form className="card p-6 space-y-3" action={`mailto:${A.email}`} method="post" encType="text/plain">
            <h2 className="font-bold text-lg">Send a message</h2>
            <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required /></div><div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required /></div></div>
            <div><label className="label" htmlFor="topic">Topic</label><select id="topic" name="topic" className="input"><option>Sales</option><option>Support</option><option>Partnerships</option><option>Press</option></select></div>
            <div><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" rows={5} className="input" required /></div>
            <button className="btn-primary">Send message</button>
            <p className="text-xs text-slate-500">By sending you agree to our <Link className="underline" href="/privacy">privacy policy</Link>.</p>
          </form>
        </div>
      </div>
      <ShareRow path="/contact" title={`Contact ${APP.name}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
