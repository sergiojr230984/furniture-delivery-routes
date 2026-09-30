"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function setContributionFloorAction(orgId: string, formData: FormData) {
  await requireRoleOrThrow("platform_admin");
  const amount = Number(formData.get("amount") || 0) || null;
  await query(`update organizations set contribution_floor_amount = $2 where id = $1`, [orgId, amount]);
  revalidatePath("/admin/settings");
}

export async function createRetailerAction(formData: FormData) {
  await requireRoleOrThrow("platform_admin");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !email || password.length < 8) {
    redirect("/admin/settings?error=" + encodeURIComponent("Fill all fields (password 8+ chars)"));
  }
  const hash = await hashPassword(password);
  await withTransaction(async (client) => {
    const org = await client.query<{ id: string }>(`insert into organizations (type, name, status) values ('retailer',$1,'active') returning id`, [name]);
    await client.query(`insert into users (org_id, role, full_name, email, password_hash) values ($1,'retailer_owner',$2,$3,$4)`, [
      org.rows[0].id,
      ownerName || name,
      email,
      hash,
    ]);
  });
  revalidatePath("/admin/organizations");
  redirect("/admin/organizations");
}
