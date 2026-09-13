import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile, rm } from "fs/promises";
import { dirname, join } from "path";

/**
 * Media storage. STORAGE_DRIVER=s3 (default when S3_ENDPOINT is set) or =local (files under LOCAL_STORAGE_DIR served by /media/*).
 * Local mode is for development and single-node deployments; production should use S3/R2 + CDN.
 */
const driver = () => process.env.STORAGE_DRIVER ?? (process.env.S3_ENDPOINT ? "s3" : "local");
export const localDir = () => process.env.LOCAL_STORAGE_DIR ?? join(process.cwd(), ".media");

let s3c: S3Client | null = null;
const s3 = () => (s3c ??= new S3Client({ region: process.env.S3_REGION || "auto", endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY || "minio", secretAccessKey: process.env.S3_SECRET_KEY || "minio12345" } }));
const bucket = () => process.env.S3_BUCKET || "velocity-media";

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string) {
  if (driver() === "local") { const f = join(localDir(), key); await mkdir(dirname(f), { recursive: true }); await writeFile(f, body); return key; }
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
  return key;
}
export async function deleteObject(key: string) {
  if (driver() === "local") { await rm(join(localDir(), key), { force: true }); return; }
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch(() => {});
}
/** Public URL for a stored key. */
export function publicUrl(key?: string | null) {
  if (!key) return null;
  if (driver() === "local") return `${process.env.APP_URL ?? ""}/media/${key}`;
  const base = process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${bucket()}`;
  return `${base}/${key}`;
}
export async function signedUrl(key: string, seconds = 900) {
  if (driver() === "local") return publicUrl(key)!;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: seconds });
}
/** Browser upload target. Local mode uploads through the app (PUT /media/:key); S3 mode returns a presigned PUT. */
export async function presignedUpload(key: string, contentType: string) {
  if (driver() === "local") return `${process.env.APP_URL ?? ""}/media/${key}`;
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn: 600 });
}
