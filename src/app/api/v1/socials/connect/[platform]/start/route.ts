import { NextResponse } from "next/server";
import { route } from "@/lib/route";
import { requireWorkspace, assertCanConnectSocial } from "@/lib/tenancy";
import { getPublisher } from "@/lib/publishers";
import { encrypt } from "@/lib/crypto";
import { err } from "@/lib/errors";
const PLATFORMS = ["tiktok", "instagram", "youtube", "linkedin"] as const;
export const GET = route(async ({ actor, params, url }) => {
  const platform = params.platform as (typeof PLATFORMS)[number]; if (!PLATFORMS.includes(platform)) throw err(400, "VALIDATION", "Unknown platform");
  const workspaceId = url.searchParams.get("workspace_id"); if (!workspaceId) throw err(400, "VALIDATION", "workspace_id required");
  const { plan } = await requireWorkspace(actor, workspaceId, "admin");
  await assertCanConnectSocial(workspaceId, plan, platform);
  const state = encrypt(JSON.stringify({ workspaceId, platform, t: Date.now(), u: actor.userId }));
  const redirectUri = `${process.env.APP_URL}/api/v1/socials/connect/${platform}/callback`;
  return NextResponse.redirect(getPublisher(platform).authUrl(encodeURIComponent(state), redirectUri));
});
