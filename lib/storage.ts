// Private file storage for proof-of-delivery photos, signatures and
// provider documents. Files live outside the web root under UPLOADS_DIR and
// are only ever served through /api/files/[key], which requires a signed,
// time-limited token (see signedFileUrl) — there is no public static path.
//
// Swap this module for an S3/Supabase Storage client in production; callers
// only depend on saveFile / readFile / signedFileUrl / verifyFileToken.
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { mkdir, readFile as fsReadFile, writeFile } from "fs/promises";
import path from "path";

function uploadsDir(): string {
  return path.join(process.cwd(), process.env.UPLOADS_DIR || ".data/uploads");
}

export async function saveFile(buffer: Buffer, ext: string): Promise<string> {
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  const key = `${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
  await writeFile(path.join(dir, key), buffer);
  return key;
}

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

export function signedFileUrl(key: string, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(key, exp);
  return `/api/files/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`;
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
