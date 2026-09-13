/** Transactional email. Uses Resend SMTP when RESEND_API_KEY is set; otherwise logs (dev). */
export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  if (!process.env.RESEND_API_KEY) { console.log(`\n[email] to=${to} subject=${subject}\n${text ?? html.replace(/<[^>]+>/g, " ")}\n`); return; }
  const nodemailer = await import("nodemailer");
  const t = nodemailer.createTransport({ host: "smtp.resend.com", port: 465, secure: true, auth: { user: "resend", pass: process.env.RESEND_API_KEY } });
  await t.sendMail({ to, from: process.env.EMAIL_FROM || "hello@example.com", subject, html, text });
}
