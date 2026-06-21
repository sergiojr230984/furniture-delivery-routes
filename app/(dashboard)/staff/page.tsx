import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { createStaff, updateRole } from "./actions";
import type { Profile } from "@/lib/types";

export default async function StaffPage() {
  const me = await getProfile();
  if (me.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  const profiles = (data ?? []) as Profile[];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Staff & users</h1>

      {/* Create login */}
      <form action={createStaff} className="card grid gap-4 p-5 sm:grid-cols-4">
        <h2 className="text-lg font-semibold sm:col-span-4">Create a login</h2>
        <div>
          <label className="label">Full name</label>
          <input name="full_name" className="input" />
        </div>
        <div>
          <label className="label">Email *</label>
          <input name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label">Password *</label>
          <input name="password" type="text" required className="input" placeholder="min 6 chars" />
        </div>
        <div>
          <label className="label">Role</label>
          <select name="role" className="input" defaultValue="salesperson">
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-4">
          <button type="submit" className="btn-primary">
            <UserPlus className="h-4 w-4" /> Create login
          </button>
        </div>
      </form>

      {/* User list */}
      <div className="card divide-y divide-gray-100">
        {profiles.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{p.full_name || p.email}</p>
              <p className="text-sm text-gray-500">{p.email}</p>
            </div>
            <form action={updateRole} className="flex items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <select name="role" defaultValue={p.role} className="input w-auto py-1.5 text-sm">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button type="submit" className="btn-secondary text-sm">Save</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
