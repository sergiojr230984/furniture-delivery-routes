import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

// Returns the signed-in user's profile, or redirects to /login.
export async function getProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // User exists in auth but has no profile row yet — sign out to recover.
    redirect("/login");
  }

  return profile as Profile;
}

export function isStaff(role: string) {
  return role === "admin" || role === "manager" || role === "salesperson";
}

export function isManager(role: string) {
  return role === "admin" || role === "manager";
}
