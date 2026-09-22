import { redirect } from "next/navigation";
import { readSession, destroySession } from "./session";
import { queryOne } from "./db";
import type { Role } from "./constants";
import { ROLE_AREA } from "./constants";
import type { User, Organization } from "./types";

export interface CurrentUser extends User {
  org: Organization;
}

// Re-reads the user + org from the database on every call (never trusts the
// signed cookie alone for authorization) so a deactivated user or a
// suspended organization is locked out immediately, not just after their
// session expires.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const row = await queryOne<User & { org: string }>(
    `select u.*, row_to_json(o.*) as org
     from users u join organizations o on o.id = u.org_id
     where u.id = $1`,
    [session.userId]
  );
  if (!row) return null;

  const { org, ...user } = row as unknown as User & { org: Organization };
  if (!user.active || org.status === "suspended" || org.status === "rejected") {
    return null;
  }
  return { ...user, org };
}

// Use in Server Components / layouts: redirects to /login when signed out.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

// Use in Server Actions / Route Handlers: throws instead of redirecting,
// since those contexts should fail loudly rather than navigate.
export async function requireUserOrThrow(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireRoleOrThrow(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUserOrThrow();
  if (!roles.includes(user.role)) throw new Error("Forbidden");
  return user;
}

export function areaForRole(role: Role) {
  return ROLE_AREA[role];
}

export async function signOut() {
  await destroySession();
}
