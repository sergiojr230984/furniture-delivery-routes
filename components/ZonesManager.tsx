"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, MapPinned } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DeliveryZone } from "@/lib/types";

export default function ZonesManager({ initial }: { initial: DeliveryZone[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addZone(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const prefixes = (fd.get("postal_prefixes") as string)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const num = (k: string) => {
      const v = fd.get(k);
      return v && String(v).trim() !== "" ? Number(v) : null;
    };

    const { error } = await supabase.from("delivery_zones").insert({
      name: fd.get("name") as string,
      color: (fd.get("color") as string) || "#2563eb",
      center_lat: num("center_lat"),
      center_lng: num("center_lng"),
      radius_km: num("radius_km"),
      postal_prefixes: prefixes,
    });
    setSaving(false);
    if (error) return setError(error.message);
    (e.target as HTMLFormElement).reset();
    setShowForm(false);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this zone?")) return;
    await supabase.from("delivery_zones").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delivery zones</h1>
          <p className="text-sm text-gray-500">
            Group deliveries by area to guide dispatch and routing.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add zone
        </button>
      </div>

      {showForm && (
        <form onSubmit={addZone} className="card grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" placeholder="North side" />
          </div>
          <div>
            <label className="label">Color</label>
            <input name="color" type="color" defaultValue="#2563eb" className="input h-10 p-1" />
          </div>
          <div>
            <label className="label">Postal prefixes (comma-sep)</label>
            <input name="postal_prefixes" className="input" placeholder="627, 6271" />
          </div>
          <div>
            <label className="label">Center latitude</label>
            <input name="center_lat" type="number" step="any" className="input" />
          </div>
          <div>
            <label className="label">Center longitude</label>
            <input name="center_lng" type="number" step="any" className="input" />
          </div>
          <div>
            <label className="label">Radius (km)</label>
            <input name="radius_km" type="number" step="any" className="input" />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="btn-primary" disabled={saving}>Save zone</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-gray-100">
        {initial.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No zones yet.</p>
        ) : (
          initial.map((z) => (
            <div key={z.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: z.color + "22" }}>
                  <MapPinned className="h-5 w-5" style={{ color: z.color }} />
                </span>
                <div>
                  <p className="font-medium">{z.name}</p>
                  <p className="text-sm text-gray-500">
                    {z.postal_prefixes.length > 0 ? `Postal: ${z.postal_prefixes.join(", ")}` : ""}
                    {z.radius_km != null ? `${z.postal_prefixes.length ? " · " : ""}${z.radius_km} km radius` : ""}
                    {z.postal_prefixes.length === 0 && z.radius_km == null ? "—" : ""}
                  </p>
                </div>
              </div>
              <button onClick={() => remove(z.id)} className="btn-secondary text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
