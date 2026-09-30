import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { addLocationAction } from "./actions";
import type { RetailerLocation } from "@/lib/types";

export default async function RetailerLocationsPage() {
  const user = await requireRole("retailer_owner", "retailer_staff");
  const locations = await query<RetailerLocation>(`select * from retailer_locations where org_id = $1 order by is_default desc, name`, [user.org_id]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Locations</h1>
      <div className="card divide-y divide-navy-100">
        {locations.map((l) => (
          <div key={l.id} className="p-4">
            <div className="font-medium text-navy-800">{l.name}</div>
            <div className="text-xs text-navy-400">{l.address_line1}, {l.city}, {l.state} {l.postal_code}</div>
          </div>
        ))}
      </div>

      {user.role === "retailer_owner" && (
        <form action={addLocationAction} className="card space-y-3 p-5">
          <h2 className="font-semibold text-navy-800">Add a location</h2>
          <input className="input" name="name" placeholder="Location name" required />
          <input className="input" name="addressLine1" placeholder="Street address" required />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" name="city" placeholder="City" defaultValue="Miami" />
            <input className="input" name="postalCode" placeholder="ZIP code" required />
          </div>
          <button type="submit" className="btn-primary w-full">
            Add location
          </button>
        </form>
      )}
    </div>
  );
}
