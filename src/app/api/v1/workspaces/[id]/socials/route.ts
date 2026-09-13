import { route } from "@/lib/route";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
export const GET = route(async ({ actor, params }) => {
  await requireWorkspace(actor, params.id);
  const rows = await db.select({ id: schema.socialAccounts.id, platform: schema.socialAccounts.platform, handle: schema.socialAccounts.handle, displayName: schema.socialAccounts.displayName, avatarUrl: schema.socialAccounts.avatarUrl, status: schema.socialAccounts.status, followers: schema.socialAccounts.followers, tokenExpiresAt: schema.socialAccounts.tokenExpiresAt, postingSlots: schema.socialAccounts.postingSlots, accountType: schema.socialAccounts.accountType }).from(schema.socialAccounts).where(eq(schema.socialAccounts.workspaceId, params.id));
  return { socials: rows, mode: process.env.PROVIDER_MODE ?? "mock" };
});
