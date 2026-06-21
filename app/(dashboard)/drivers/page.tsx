import { UserCog, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CREW_TYPES } from "@/lib/constants";
import { createDriver, deleteDriver, toggleDriverActive } from "./actions";
import type { Driver } from "@/lib/types";

export default async function DriversPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("drivers").select("*").order("full_name");
  const drivers = (data ?? []) as Driver[];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Drivers & crew</h1>

      {/* Add form */}
      <form action={createDriver} className="card grid gap-4 p-5 sm:grid-cols-3">
        <h2 className="text-lg font-semibold sm:col-span-3">Add crew member</h2>
        <div>
          <label className="label">Full name *</label>
          <input name="full_name" required className="input" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" className="input" />
        </div>
        <div>
          <label className="label">Role</label>
          <select name="crew_type" className="input" defaultValue="driver">
            {CREW_TYPES.map((t) => (
              <option key={t} value={t}>{t === "driver" ? "Driver" : "Helper"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">License number</label>
          <input name="license_number" className="input" />
        </div>
        <div>
          <label className="label">Login email (optional)</label>
          <input name="email" type="email" className="input" placeholder="driver@store.com" />
        </div>
        <div>
          <label className="label">Login password (optional)</label>
          <input name="password" type="text" className="input" placeholder="min 6 chars" />
        </div>
        <p className="text-xs text-gray-400 sm:col-span-3">
          Add an email + password to give a driver access to the mobile driver app.
        </p>
        <div className="sm:col-span-3">
          <button type="submit" className="btn-primary">
            <Plus className="h-4 w-4" /> Add crew member
          </button>
        </div>
      </form>

      {/* List */}
      <div className="card divide-y divide-gray-100">
        {drivers.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No crew yet.</p>
        ) : (
          drivers.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                  <UserCog className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium">
                    {d.full_name}
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {d.crew_type}
                    </span>
                    {d.profile_id && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        has login
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {[d.phone, d.license_number].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <form action={toggleDriverActive}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="active" value={String(d.active)} />
                  <button type="submit" className="btn-secondary text-sm">
                    {d.active ? "Active" : "Inactive"}
                  </button>
                </form>
                <form action={deleteDriver}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="btn-secondary text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
