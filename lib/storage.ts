// Private file storage for proof-of-delivery photos, signatures and
// provider documents. Two backends, chosen automatically:
//
//  - R2 (or any S3-compatible bucket) when R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/
//    R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME are set: files live in a private
//    bucket and are only ever reachable via a short-lived presigned GET URL
//    minted on demand — the same "app decides when you're allowed to see
//    this" model as the local fallback, and it survives a serverless
//    deploy (Vercel functions have no persistent disk).
//  - Local disk (.data/uploads) otherwise, served through /api/files/[key]
//    behind an HMAC-signed, short-lived token — so a complete demo still
//    works with zero cloud credentials.
//
// Callers only depend on saveFile / signedFileUrl (and, in local mode,
// readStoredFile + verifyFileToken for the route handler) — nothing else
// in the app knows or cares which backend is active.
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { mkdir, readFile as fsReadFile, writeFile } from "fs/promises";
import path from "path";

const R2_BUCKET = process.env.R2_BUCKET_NAME;
const r2Configured = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  R2_BUCKET
);

let s3Client: import("@aws-sdk/client-s3").S3Client | null = null;
async function getS3Client() {
  if (!s3Client) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

function uploadsDir(): string {
  return path.join(process.cwd(), process.env.UPLOADS_DIR || ".data/uploads");
}

function makeKey(ext: string): string {
  return `${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
}

export async function saveFile(buffer: Buffer, ext: string): Promise<string> {
  const key = makeKey(ext);

  if (r2Configured) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentTypeForKey(key),
      })
    );
    return key;
  }

  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), buffer);
  return key;
}

// Local-disk mode only — the R2 backend is never read through the app
// server; presigned URLs point straight at the bucket.
export async function readStoredFile(key: string): Promise<Buffer> {
  assertSafeKey(key);
  return fsReadFile(path.join(uploadsDir(), key));
}

function assertSafeKey(key: string) {
  if (key.includes("..") || key.includes("/") || key.includes("\\")) {
    throw new Error("Invalid file key");
  }
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return s;
}

function sign(key: string, exp: number): string {
  return createHmac("sha256", secret()).update(`${key}.${exp}`).digest("base64url");
}

export async function signedFileUrl(key: string, ttlSeconds = 600): Promise<string> {
  if (r2Configured) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await getS3Client();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: ttlSeconds });
  }

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(key, exp);
  return `/api/files/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`;
}

// Resolves signed URLs for a batch of keys in parallel — use this in
// Server Components instead of calling signedFileUrl per item in a map(),
// since it's now async (a real network round-trip in R2 mode).
export async function signedFileUrls(keys: string[], ttlSeconds = 600): Promise<Record<string, string>> {
  const entries = await Promise.all(keys.map(async (k) => [k, await signedFileUrl(k, ttlSeconds)] as const));
  return Object.fromEntries(entries);
}

export function verifyFileToken(key: string, exp: number, sig: string): boolean {
  if (Number.isNaN(exp) || exp < Date.now() / 1000) return false;
  const expected = sign(key, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const EXT_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXT_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function isR2Configured(): boolean {
  return r2Configured;
}
