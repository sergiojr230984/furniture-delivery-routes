import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { addVehicleAction, setVehicleStatusAction } from "./actions";
import type { ProviderVehicle } from "@/lib/types";

export default async function ProviderVehiclesPage() {
  const user = await requireRole("provider_owner");
  const vehicles = await query<ProviderVehicle>(`select * from provider_vehicles where org_id = $1 order by created_at`, [user.org_id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Vehicles</h1>

      <div className="card divide-y divide-navy-100">
        {vehicles.map((v) => (
          <div key={v.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium text-navy-800">{v.name}</div>
              <div className="text-xs text-navy-400">
                {v.vehicle_type} · {v.payload_lbs} lbs payload · {v.max_jobs_per_day} jobs/day · door {v.door_width_in}&quot;
              </div>
            </div>
            <form action={setVehicleStatusAction.bind(null, v.id, v.status === "active" ? "inactive" : "active")}>
              <button type="submit" className={v.status === "active" ? "btn-secondary" : "btn-primary"}>
                {v.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <form action={addVehicleAction} className="card space-y-3 p-5">
        <h2 className="font-semibold text-navy-800">Add vehicle</h2>
        <input className="input" name="name" placeholder="Name (e.g. Van 2)" required />
        <select className="input" name="vehicleType" defaultValue="cargo_van">
          <option value="cargo_van">Cargo van</option>
          <option value="box_truck">Box truck</option>
          <option value="pickup_with_trailer">Pickup + trailer</option>
        </select>
        <div className="grid grid-cols-3 gap-3">
          <input className="input" name="cargoLengthIn" type="number" placeholder="Cargo length (in)" />
          <input className="input" name="cargoWidthIn" type="number" placeholder="Cargo width (in)" />
          <input className="input" name="cargoHeightIn" type="number" placeholder="Cargo height (in)" />
        </div>
        <input className="input" name="doorWidthIn" type="number" placeholder="Door opening width (in)" />
        <input className="input" name="payloadLbs" type="number" placeholder="Payload (lbs)" defaultValue={1500} />
        <input className="input" name="maxJobsPerDay" type="number" placeholder="Max jobs per day" defaultValue={5} />
        <input className="input" name="licensePlate" placeholder="License plate (optional)" />
        <button type="submit" className="btn-primary w-full">
          Add vehicle
        </button>
      </form>
    </div>
  );
}
