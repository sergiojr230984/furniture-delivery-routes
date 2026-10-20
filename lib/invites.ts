// Staff invite-by-email: lets an org owner invite a login by email instead
// of picking a temporary password for them. The invite link always works
// in demo mode — even with no SMTP configured, the link itself is shown to
// the inviting owner (lib/notify.ts's email channel no-ops to the demo
// outbox, same as every other channel without real credentials).
import { randomBytes } from "crypto";
import { query, queryOne } from "./db";
import { hashPassword } from "./password";
import { sendNotification } from "./notify";
import { baseUrl } from "./tracking";
import type { Role } from "./constants";

const INVITE_TTL_DAYS = 7;

export interface PendingInvite {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  token: string;
  expires_at: string;
  created_at: string;
}

export function inviteUrl(token: string): string {
  return `${baseUrl()}/invite/${token}`;
}

export class DuplicateInviteError extends Error {
  constructor() {
    super("There's already a pending invite for this email.");
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("That email already has a login.");
  }
}

export async function createInvite(opts: {
  orgId: string;
  role: Role;
  email: string;
  fullName: string | null;
  invitedBy: string;
}): Promise<{ token: string; url: string }> {
  const existingUser = await queryOne(`select id from users where email = $1`, [opts.email]);
  if (existingUser) throw new EmailAlreadyRegisteredError();

  const existing = await queryOne(
    `select id from staff_invites where org_id = $1 and email = $2 and accepted_at is null`,
    [opts.orgId, opts.email]
  );
  if (existing) throw new DuplicateInviteError();

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();

  await query(
    `insert into staff_invites (org_id, role, full_name, email, token, invited_by, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [opts.orgId, opts.role, opts.fullName, opts.email, token, opts.invitedBy, expiresAt]
  );

  const url = inviteUrl(token);
  await sendNotification({
    orgId: opts.orgId,
    channel: "email",
    to: opts.email,
    subject: "You're invited to Belliza Delivery",
    body: `${opts.fullName ? `Hi ${opts.fullName}, y` : "Y"}ou've been invited to join Belliza Delivery. Set your password to get started: ${url}`,
  });

  return { token, url };
}

export async function listPendingInvites(orgId: string): Promise<PendingInvite[]> {
  return query<PendingInvite>(
    `select id, email, full_name, role, token, expires_at, created_at
     from staff_invites
     where org_id = $1 and accepted_at is null
     order by created_at desc`,
    [orgId]
  );
}

export async function revokeInvite(id: string, orgId: string): Promise<void> {
  await query(`delete from staff_invites where id = $1 and org_id = $2 and accepted_at is null`, [id, orgId]);
}

export interface ResolvedInvite {
  id: string;
  org_id: string;
  role: Role;
  full_name: string | null;
  email: string;
}

export async function resolveInvite(token: string): Promise<ResolvedInvite | null> {
  const row = await queryOne<ResolvedInvite & { expires_at: string; accepted_at: string | null }>(
    `select id, org_id, role, full_name, email, expires_at, accepted_at
     from staff_invites where token = $1`,
    [token]
  );
  if (!row) return null;
  if (row.accepted_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  const { expires_at: _e, accepted_at: _a, ...invite } = row;
  return invite;
}

// Creates the login and marks the invite accepted, atomically enough for a
// single-row update guard: the `accepted_at is null` clause means a second
// concurrent accept of the same token updates zero rows and throws.
export async function acceptInvite(
  token: string,
  password: string
): Promise<{ userId: string; orgId: string; role: Role } | null> {
  const invite = await resolveInvite(token);
  if (!invite) return null;

  const hash = await hashPassword(password);
  const user = await queryOne<{ id: string }>(
    `insert into users (org_id, role, full_name, email, password_hash) values ($1,$2,$3,$4,$5) returning id`,
    [invite.org_id, invite.role, invite.full_name ?? invite.email.split("@")[0], invite.email, hash]
  );
  if (!user) return null;

  const updated = await query(
    `update staff_invites set accepted_at = now() where token = $1 and accepted_at is null returning id`,
    [token]
  );
  if (updated.length === 0) {
    // Lost a race with a concurrent accept of the same token — don't leave
    // two user rows behind for one invite.
    await query(`delete from users where id = $1`, [user.id]);
    return null;
  }

  return { userId: user.id, orgId: invite.org_id, role: invite.role };
}
