"use server";

import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { homePathForRole, type Role } from "@/lib/constants";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=1");
  }

  const user = await queryOne<{
    id: string;
    org_id: string;
    role: Role;
    password_hash: string;
    active: boolean;
    locale: string;
    org_status: string;
  }>(
    `select u.id, u.org_id, u.role, u.password_hash, u.active, u.locale, o.status as org_status
     from users u join organizations o on o.id = u.org_id
     where u.email = $1`,
    [email]
  );

  if (!user || !user.active || user.org_status === "suspended" || user.org_status === "rejected") {
    redirect("/login?error=1");
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    redirect("/login?error=1");
  }

  await createSession({
    userId: user.id,
    orgId: user.org_id,
    role: user.role,
    locale: user.locale === "es" ? "es" : "en",
  });

  redirect(homePathForRole(user.role));
}
