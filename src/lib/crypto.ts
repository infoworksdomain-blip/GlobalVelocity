import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
const key = () => Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || createHash("sha256").update(process.env.AUTH_SECRET || "dev").digest("hex"), "hex").subarray(0, 32);
export function encrypt(plain: string) {
  const iv = randomBytes(12); const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}
export function decrypt(blob: string) {
  const [iv, tag, data] = blob.split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
export const icsToken = (wsId: string) => createHash("sha256").update(`ics:${wsId}:${process.env.AUTH_SECRET ?? "dev"}`).digest("hex").slice(0, 32);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (n = 24) => randomBytes(n).toString("base64url");
