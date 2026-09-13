import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
export const metadata = { title: "Log in" };
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const session = await auth();
  if (session?.user) redirect(sp.plan ? `/app/settings/billing?plan=${sp.plan}&interval=${sp.interval ?? "month"}` : "/app");
  const callbackUrl = sp.plan ? `/app/settings/billing?plan=${sp.plan}&interval=${sp.interval ?? "month"}` : sp.callbackUrl ?? "/app";
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="card w-full max-w-md p-8">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg"><span className="inline-block h-7 w-7 rounded-lg bg-brand-600" />Velocity</Link>
        <h1 className="mt-6 text-2xl font-bold">{sp.check ? "Check your email" : "Sign in or create an account"}</h1>
        {sp.check ? <p className="mt-2 text-slate-600">We sent you a magic link. In development without an email provider, the link is printed in the server log.</p> : (
          <>
            <p className="mt-1 text-sm text-slate-600">No password needed — we'll email you a magic link.</p>
            <form className="mt-6 space-y-3" action={async (fd) => { "use server"; await signIn("nodemailer", { email: String(fd.get("email")), redirectTo: callbackUrl }); }}>
              <input className="input" name="email" type="email" placeholder="you@company.com" required autoFocus />
              <button className="btn-primary w-full">Continue with email</button>
            </form>
            {process.env.AUTH_GOOGLE_ID && <form action={async () => { "use server"; await signIn("google", { redirectTo: callbackUrl }); }} className="mt-3"><button className="btn-secondary w-full">Continue with Google</button></form>}
            {process.env.AUTH_APPLE_ID && <form action={async () => { "use server"; await signIn("apple", { redirectTo: callbackUrl }); }} className="mt-3"><button className="btn-secondary w-full">Continue with Apple</button></form>}
            <p className="mt-6 text-xs text-slate-500">By continuing you agree to our <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy policy</Link>.</p>
          </>
        )}
      </div>
    </div>
  );
}
