import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { startBookingAction } from "./actions";

export default async function NewBookingPage() {
  const user = await requireRole("retailer_owner", "retailer_staff");
  const locations = await query<{ id: string; name: string }>(
    `select id, name from retailer_locations where org_id = $1 and active = true order by is_default desc, name`,
    [user.org_id]
  );

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-navy-900">Book a Delivery</h1>
      <p className="mt-1 text-navy-500">Which store is this delivery going out from?</p>

      <form action={startBookingAction} className="card mt-6 space-y-4 p-5">
        <div>
          <label className="label" htmlFor="locationId">
            Store location
          </label>
          <select className="input" id="locationId" name="locationId" required>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary w-full">
          Start booking
        </button>
      </form>
    </div>
  );
}
