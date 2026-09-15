import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema } from "@/db";
import { ensureAccountForUser } from "@/lib/tenancy";

// Magic link: with RESEND_API_KEY set, emails go via the Resend HTTP API (not SMTP -- outbound SMTP is
// blocked/throttled on some PaaS hosts); without it, the link is logged (dev).
const providers = [
  Nodemailer({
    from: process.env.EMAIL_FROM || "login@example.com",
    server: { jsonTransport: true },
    async sendVerificationRequest({ identifier, url, provider }) {
      if (!process.env.RESEND_API_KEY) { console.log(`\n[magic-link] ${identifier} -> ${url}\n`); return; }
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ to: identifier, from: provider.from, subject: `Sign in to ${process.env.APP_NAME ?? "Velocity"}`, text: `Sign in: ${url}`, html: `<p><a href="${url}">Click here to sign in</a></p>` }),
      });
      if (!r.ok) throw new Error(`Resend send failed ${r.status}: ${await r.text()}`);
    },
  }),
  ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
  ...(process.env.AUTH_APPLE_ID ? [Apple] : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, { usersTable: schema.users, accountsTable: schema.authAccounts, sessionsTable: schema.sessions, verificationTokensTable: schema.verificationTokens }),
  providers,
  trustHost: true, // behind a proxy/load balancer; APP_URL is the canonical origin
  basePath: "/api/auth",
  session: { strategy: "database" },
  pages: { signIn: "/login", verifyRequest: "/login?check=1" },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async createUser({ user }) { if (user.id) await ensureAccountForUser(user.id); },
    async signIn({ user }) { if (user.id) await ensureAccountForUser(user.id); },
  },
});
