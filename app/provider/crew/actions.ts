"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRoleOrThrow } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { randomBytes } from "crypto";

export async function addCrewMemberAction(formData: FormData) {
  const user = await requireRoleOrThrow("provider_owner");
  await query(`insert into crew_members (org_id, full_name, phone, can_assemble) values ($1,$2,$3,$4)`, [
    user.org_id,
    String(formData.get("fullName") || ""),
    String(formData.get("phone") || "") || null,
    formData.get("canAssemble") === "on",
  ]);
  revalidatePath("/provider/crew");
}

export async function toggleCrewActiveAction(crewId: string, active: boolean) {
  const user = await requireRoleOrThrow("provider_owner");
  await query(`update crew_members set active = $3 where id = $1 and org_id = $2`, [crewId, user.org_id, active]);
  revalidatePath("/provider/crew");
}

// Provisions a mobile-job-screen login for an existing crew member. Returns
// the temporary password so the owner can hand it to the crew member; in a
// production build this would be emailed/texted via lib/notify instead.
export async function provisionCrewLoginAction(crewId: string, formData: FormData) {
  const user = await requireRoleOrThrow("provider_owner");
  const crew = await queryOne<{ full_name: string; user_id: string | null }>(
    `select full_name, user_id from crew_members where id = $1 and org_id = $2`,
    [crewId, user.org_id]
  );
  if (!crew || crew.user_id) return;

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return;

  const tempPassword = randomBytes(4).toString("hex");
  const hash = await hashPassword(tempPassword);
  const newUser = await query<{ id: string }>(
    `insert into users (org_id, role, full_name, email, password_hash) values ($1,'crew_member',$2,$3,$4) returning id`,
    [user.org_id, crew.full_name, email, hash]
  );
  await query(`update crew_members set user_id = $1 where id = $2`, [newUser[0].id, crewId]);
  revalidatePath("/provider/crew");
  redirect(`/provider/crew?created=${encodeURIComponent(email)}&temp=${tempPassword}`);
}
