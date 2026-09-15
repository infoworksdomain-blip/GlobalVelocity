import { route, parse } from "@/lib/route";
import { err } from "@/lib/errors";
import { presignedUpload } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";
import { z } from "zod";
/** Step 1 of bulk UGC clip ingest: presign N direct-to-storage upload URLs. Admin only. */
export const POST = route(async ({ actor, body }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const b = parse(z.object({ files: z.array(z.object({ filename: z.string().max(200), content_type: z.string().max(100) })).min(1).max(200) }), body);
  const uploads = await Promise.all(b.files.map(async (f) => {
    const ext = f.filename.split(".").pop()?.toLowerCase() ?? "mp4";
    const key = `library/ugc/${randomToken(12)}.${ext}`;
    return { key, upload_url: await presignedUpload(key, f.content_type) };
  }));
  return { uploads };
});
