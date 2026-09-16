import { route, parse } from "@/lib/route";
import { err } from "@/lib/errors";
import { presignedUpload } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";
import { z } from "zod";
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);
/** Step 1 of bulk UGC image ingest: presign N direct-to-storage upload URLs. Admin only. Mirrors
 *  admin/ugc-clips/batch-presign exactly, image extensions instead of video. */
export const POST = route(async ({ actor, body }) => {
  if (!actor.isPlatformAdmin) throw err(403, "FORBIDDEN", "Admin only");
  const b = parse(z.object({ files: z.array(z.object({ filename: z.string().max(200), content_type: z.string().max(100) })).min(1).max(200) }), body);
  const uploads = await Promise.all(b.files.map(async (f) => {
    const raw = f.filename.split(".").pop()?.toLowerCase() ?? "";
    const ext = IMAGE_EXTS.has(raw) ? raw : "jpg"; // allowlist: an unrecognized/malformed extension is silently coerced, not rejected, so one bad filename can't abort a large batch
    const key = `library/ugc-images/${randomToken(12)}.${ext}`;
    return { key, upload_url: await presignedUpload(key, f.content_type) };
  }));
  return { uploads };
});
