import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MeProvider } from "@/lib/use-me";
import { AppShell } from "@/components/app-shell";
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth(); if (!session?.user) redirect("/login");
  return <MeProvider><AppShell>{children}</AppShell></MeProvider>;
}
