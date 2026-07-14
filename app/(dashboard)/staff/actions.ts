"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") throw new Error("Not authorized");
}

// Invites a staff member (admin / manager / salesperson / driver) by email.
// They receive a Supabase invite email and set their own password.
export async function inviteStaff(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();

  const email = (formData.get("email") as string)?.trim();
  const fullName = (formData.get("full_name") as string)?.trim();
  const role = (formData.get("role") as string) || "salesperson";

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/set-password`,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/staff");
}

export async function updateRole(formData: FormData) {
  await assertAdmin();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const role = formData.get("role") as string;
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/staff");
}
