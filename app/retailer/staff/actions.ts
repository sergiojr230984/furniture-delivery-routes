"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export async function addStaffAction(formData: FormData) {
  const user = await requireRoleOrThrow("retailer_owner");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !fullName || password.length < 8) {
    redirect("/retailer/staff?error=" + encodeURIComponent("Fill all fields (password 8+ chars)"));
  }
  const hash = await hashPassword(password);
  await query(`insert into users (org_id, role, full_name, email, password_hash) values ($1,'retailer_staff',$2,$3,$4)`, [
    user.org_id,
    fullName,
    email,
    hash,
  ]);
  revalidatePath("/retailer/staff");
}

export async function toggleStaffActiveAction(userId: string, active: boolean) {
  const user = await requireRoleOrThrow("retailer_owner");
  await query(`update users set active = $3 where id = $1 and org_id = $2 and role = 'retailer_staff'`, [userId, user.org_id, active]);
  revalidatePath("/retailer/staff");
}
