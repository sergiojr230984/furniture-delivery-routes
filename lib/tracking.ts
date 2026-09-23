import { randomBytes } from "crypto";
import { query, queryOne } from "./db";

const TRACKING_TTL_DAYS = 30;
const ACCESS_LINK_TTL_DAYS = 14;

export function baseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

function token(): string {
  return randomBytes(24).toString("base64url");
}

export async function createTrackingToken(bookingId: string): Promise<string> {
  const t = token();
  const expiresAt = new Date(Date.now() + TRACKING_TTL_DAYS * 86_400_000).toISOString();
  await query(`insert into tracking_tokens (booking_id, token, expires_at) values ($1,$2,$3)`, [
    bookingId,
    t,
    expiresAt,
  ]);
  return t;
}

export function trackingUrl(t: string): string {
  return `${baseUrl()}/track/${t}`;
}

export async function resolveTrackingToken(t: string): Promise<{ bookingId: string } | null> {
  const row = await queryOne<{ booking_id: string; expires_at: string }>(
    `select booking_id, expires_at from tracking_tokens where token = $1`,
    [t]
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { bookingId: row.booking_id };
}

// Secure link for the recipient to complete missing destination access
// details before final pricing/confirmation.
export async function createAccessToken(bookingId: string): Promise<string> {
  const t = token();
  const expiresAt = new Date(Date.now() + ACCESS_LINK_TTL_DAYS * 86_400_000).toISOString();
  await query(
    `update booking_destination set access_token = $2, access_token_expires_at = $3 where booking_id = $1`,
    [bookingId, t, expiresAt]
  );
  return t;
}

export function accessUrl(t: string): string {
  return `${baseUrl()}/access/${t}`;
}

export async function resolveAccessToken(t: string): Promise<{ bookingId: string } | null> {
  const row = await queryOne<{ booking_id: string; access_token_expires_at: string | null }>(
    `select booking_id, access_token_expires_at from booking_destination where access_token = $1`,
    [t]
  );
  if (!row) return null;
  if (row.access_token_expires_at && new Date(row.access_token_expires_at).getTime() < Date.now()) {
    return null;
  }
  return { bookingId: row.booking_id };
}
