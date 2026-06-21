"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  VEHICLE_STATUSES,
  VEHICLE_STATUS_LABELS,
  type VehicleStatus,
} from "@/lib/constants";
import type { Vehicle } from "@/lib/types";

export default function VehiclesManager({ initial }: { initial: Vehicle[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addVehicle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("vehicles").insert({
      name: fd.get("name") as string,
      make: (fd.get("make") as string) || null,
      model: (fd.get("model") as string) || null,
      year: fd.get("year") ? Number(fd.get("year")) : null,
      license_plate: (fd.get("license_plate") as string) || null,
      capacity_weight: fd.get("capacity_weight") ? Number(fd.get("capacity_weight")) : null,
      capacity_volume: fd.get("capacity_volume") ? Number(fd.get("capacity_volume")) : null,
      avg_speed_kmh: fd.get("avg_speed_kmh") ? Number(fd.get("avg_speed_kmh")) : 40,
      max_stops: fd.get("max_stops") ? Number(fd.get("max_stops")) : null,
      avoid_tolls: fd.get("avoid_tolls") === "on",
      status: (fd.get("status") as string) || "available",
    });
    setSaving(false);
    if (error) return setError(error.message);
    setShowForm(false);
    router.refresh();
  }

  async function changeStatus(id: string, status: string) {
    await supabase.from("vehicles").update({ status }).eq("id", id);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this vehicle?")) return;
    await supabase.from("vehicles").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add vehicle
        </button>
      </div>

      {showForm && (
        <form onSubmit={addVehicle} className="card grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" placeholder="Van 1" />
          </div>
          <div>
            <label className="label">Make</label>
            <input name="make" className="input" />
          </div>
          <div>
            <label className="label">Model</label>
            <input name="model" className="input" />
          </div>
          <div>
            <label className="label">Year</label>
            <input name="year" type="number" className="input" />
          </div>
          <div>
            <label className="label">License plate</label>
            <input name="license_plate" className="input" />
          </div>
          <div>
            <label className="label">Capacity (weight)</label>
            <input name="capacity_weight" type="number" className="input" />
          </div>
          <div>
            <label className="label">Capacity (volume)</label>
            <input name="capacity_volume" type="number" className="input" />
          </div>
          <div>
            <label className="label">Avg speed (km/h)</label>
            <input name="avg_speed_kmh" type="number" className="input" defaultValue={40} />
          </div>
          <div>
            <label className="label">Max stops</label>
            <input name="max_stops" type="number" className="input" />
          </div>
          <label className="flex items-center gap-2 pt-6 text-sm text-gray-700">
            <input name="avoid_tolls" type="checkbox" className="h-4 w-4" /> Avoid tolls
          </label>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input" defaultValue="available">
              {VEHICLE_STATUSES.map((s) => (
                <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>Save</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-gray-100">
        {initial.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No vehicles yet.</p>
        ) : (
          initial.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                  <Truck className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm text-gray-500">
                    {[v.make, v.model, v.year].filter(Boolean).join(" ") || "—"}
                    {v.license_plate ? ` · ${v.license_plate}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={v.status}
                  onChange={(e) => changeStatus(v.id, e.target.value)}
                  className="input w-auto py-1.5 text-sm"
                >
                  {VEHICLE_STATUSES.map((s) => (
                    <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <button onClick={() => remove(v.id)} className="btn-secondary text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
