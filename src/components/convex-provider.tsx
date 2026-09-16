"use client";
import { useMemo } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

/** Scoped to just the /app/ghost-mode route segment (see src/app/app/ghost-mode/layout.tsx) -- Convex is
 * an optional, additive live-progress mirror for the wizard, not used anywhere else in the app. */
export function GhostModeConvexProvider({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => (url ? new ConvexReactClient(url) : null), [url]);
  if (!client) return <>{children}</>;
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
