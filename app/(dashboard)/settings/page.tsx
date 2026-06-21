import { redirect } from "next/navigation";
import { Warehouse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isManager } from "@/lib/auth";
import { saveSettings } from "./actions";
import type { OrgSettings } from "@/lib/types";

export default async function SettingsPage() {
  const me = await getProfile();
  if (!isManager(me.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase.from("org_settings").select("*").eq("id", 1).single();
  const s = (data ?? {}) as Partial<OrgSettings>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Routing settings</h1>
        <p className="text-sm text-gray-500">
          The depot is the start/end point routes are optimised around.
        </p>
      </div>

      <form action={saveSettings} className="card space-y-5 p-5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Warehouse className="h-5 w-5 text-brand-600" /> Depot / warehouse
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Depot name</label>
            <input name="depot_name" className="input" defaultValue={s.depot_name ?? ""} placeholder="Main warehouse" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Depot address</label>
            <input name="depot_address" className="input" defaultValue={s.depot_address ?? ""} />
          </div>
          <div>
            <label className="label">Depot latitude</label>
            <input name="depot_lat" type="number" step="any" className="input" defaultValue={s.depot_lat ?? ""} placeholder="39.7817" />
          </div>
          <div>
            <label className="label">Depot longitude</label>
            <input name="depot_lng" type="number" step="any" className="input" defaultValue={s.depot_lng ?? ""} placeholder="-89.6501" />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h2 className="mb-3 font-semibold">Defaults</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Default service time (min/stop)</label>
              <input name="default_service_minutes" type="number" min={1} className="input" defaultValue={s.default_service_minutes ?? 15} />
            </div>
            <div>
              <label className="label">Default avg speed (km/h)</label>
              <input name="default_avg_speed_kmh" type="number" min={1} className="input" defaultValue={s.default_avg_speed_kmh ?? 40} />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Service time is learned automatically per customer from completed
            deliveries; these values are the fallback when there&apos;s no history yet.
          </p>
        </div>

        <button type="submit" className="btn-primary">Save settings</button>
      </form>
    </div>
  );
}
