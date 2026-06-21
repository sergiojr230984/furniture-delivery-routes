"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManager } from "@/lib/auth";

// Ensures the caller is a manager/admin before privileged actions.
async function assertManager() {
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
  if (!profile || !isManager(profile.role)) {
    throw new Error("Not authorized");
  }
}

// Creates a crew member and, optionally, a login account for the driver app.
export async function createDriver(formData: FormData) {
  await assertManager();
  const supabase = await createClient();

  const fullName = (formData.get("full_name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const license = (formData.get("license_number") as string)?.trim() || null;
  const crewType = (formData.get("crew_type") as string) || "driver";
  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string)?.trim();

  let profileId: string | null = null;

  // If credentials were supplied, provision an auth login with the driver role.
  if (email && password) {
    const admin = createAdminClient();
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, role: "driver" },
    });
    if (authErr) throw new Error(authErr.message);
    profileId = created.user?.id ?? null;
  }

  const { error } = await supabase.from("drivers").insert({
    full_name: fullName,
    phone,
    license_number: license,
    crew_type: crewType,
    profile_id: profileId,
    active: true,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/drivers");
}

export async function deleteDriver(formData: FormData) {
  await assertManager();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("drivers").delete().eq("id", id);
  revalidatePath("/drivers");
}

export async function toggleDriverActive(formData: FormData) {
  await assertManager();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const active = formData.get("active") === "true";
  await supabase.from("drivers").update({ active: !active }).eq("id", id);
  revalidatePath("/drivers");
}
