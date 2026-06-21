"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// Creates a login for a staff member (admin / manager / salesperson / driver).
export async function createStaff(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();

  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();
  const fullName = (formData.get("full_name") as string)?.trim();
  const role = (formData.get("role") as string) || "salesperson";

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
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
