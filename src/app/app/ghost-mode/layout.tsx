import { GhostModeConvexProvider } from "@/components/convex-provider";

export default function GhostModeLayout({ children }: { children: React.ReactNode }) {
  return <GhostModeConvexProvider>{children}</GhostModeConvexProvider>;
}
