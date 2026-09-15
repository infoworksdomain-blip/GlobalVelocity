/** Transactional email. Uses the Resend HTTP API when RESEND_API_KEY is set; otherwise logs (dev).
 *  HTTP, not SMTP: outbound SMTP (port 465/587) is blocked or badly throttled on some PaaS hosts. */
export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  if (!process.env.RESEND_API_KEY) { console.log(`\n[email] to=${to} subject=${subject}\n${text ?? html.replace(/<[^>]+>/g, " ")}\n`); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ to, from: process.env.EMAIL_FROM || "hello@example.com", subject, html, text }),
  });
  if (!r.ok) throw new Error(`Resend send failed ${r.status}: ${await r.text()}`);
}
