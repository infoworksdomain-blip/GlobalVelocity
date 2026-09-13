import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getPublisher } from "@/lib/publishers";
import { decrypt, encrypt } from "@/lib/crypto";
import { audit } from "@/lib/tenancy";
import type { Platform } from "@/db/schema";
export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params; const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${process.env.APP_URL}/app/settings/socials?${q}`);
  try {
    const state = JSON.parse(decrypt(decodeURIComponent(url.searchParams.get("state") ?? "")));
    if (Date.now() - state.t > 15 * 60_000) return back("error=state_expired");
    const code = url.searchParams.get("code"); if (!code) return back(`error=${url.searchParams.get("error") ?? "denied"}`);
    const t = await getPublisher(platform as Platform).exchange(code, `${process.env.APP_URL}/api/v1/socials/connect/${platform}/callback`);
    await db.insert(schema.socialAccounts).values({ workspaceId: state.workspaceId, platform: platform as Platform, externalId: t.externalId, handle: t.handle, displayName: t.displayName, avatarUrl: t.avatarUrl, accountType: t.accountType, accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : null, tokenExpiresAt: t.expiresAt, scopes: t.scopes, status: "active" })
      .onConflictDoUpdate({ target: [schema.socialAccounts.workspaceId, schema.socialAccounts.platform, schema.socialAccounts.externalId], set: { accessTokenEnc: encrypt(t.accessToken), refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : undefined, tokenExpiresAt: t.expiresAt, status: "active", handle: t.handle, displayName: t.displayName, avatarUrl: t.avatarUrl } });
    await audit({ workspaceId: state.workspaceId, actorId: state.u, action: "social.connect", meta: { platform } });
    return back(`connected=${platform}`);
  } catch (e) { console.error(e); return back("error=connect_failed"); }
}
