import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { assertBookingOwnedByOrg } from "@/lib/booking-service";
import { savePickupAction } from "../../actions";
import BookingWizardSteps from "@/components/BookingWizardSteps";

export default async function PickupStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(id, user.org_id);

  const locations = await query<{ id: string; name: string; address_line1: string; city: string }>(
    `select id, name, address_line1, city from retailer_locations where org_id = $1 and active = true order by is_default desc, name`,
    [user.org_id]
  );
  const warehouses = await query<{ id: string; name: string; address_line1: string; city: string }>(
    `select id, name, address_line1, city from belliza_warehouses order by name`
  );

  const action = savePickupAction.bind(null, id);

  return (
    <div className="mx-auto max-w-lg">
      <BookingWizardSteps current="pickup" />
      <h1 className="text-2xl font-bold text-navy-900">Where should we pick up?</h1>

      <form action={action} className="card mt-6 space-y-4 p-5">
        <input type="hidden" name="pickupType" value="store" />
        <h2 className="font-semibold text-navy-800">One of our stores</h2>
        <select className="input" name="locationId" defaultValue={locations[0]?.id}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {l.address_line1}, {l.city}
            </option>
          ))}
        </select>
        <AccessFields />
        <button type="submit" className="btn-primary w-full">
          Use this store
        </button>
      </form>

      <form action={savePickupAction.bind(null, id)} className="card mt-4 space-y-4 p-5">
        <input type="hidden" name="pickupType" value="warehouse" />
        <h2 className="font-semibold text-navy-800">Belliza warehouse</h2>
        <select className="input" name="warehouseId" defaultValue={warehouses[0]?.id}>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} — {w.address_line1}, {w.city}
            </option>
          ))}
        </select>
        <div>
          <label className="label">Belliza order number</label>
          <input className="input" name="warehouseOrderNumber" placeholder="e.g. WH-00456" />
        </div>
        <AccessFields />
        <button type="submit" className="btn-secondary w-full">
          Use warehouse pickup
        </button>
      </form>

      <form action={savePickupAction.bind(null, id)} className="card mt-4 space-y-4 p-5">
        <input type="hidden" name="pickupType" value="address" />
        <h2 className="font-semibold text-navy-800">Another address</h2>
        <input className="input" name="addressLine1" placeholder="Street address" />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" name="city" placeholder="City" defaultValue="Miami" />
          <input className="input" name="postalCode" placeholder="ZIP code" />
        </div>
        <AccessFields />
        <button type="submit" className="btn-secondary w-full">
          Use this address
        </button>
      </form>

      <p className="mt-4 text-xs text-navy-400">
        Need more than one pickup stop? You can add additional pickups from the booking detail page after this one
        is created — most bookings only need one.
      </p>
    </div>
  );
}

function AccessFields() {
  return (
    <div className="space-y-3 border-t border-navy-100 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <input className="input" name="contactName" placeholder="Contact name (optional)" />
        <input className="input" name="contactPhone" placeholder="Contact phone (optional)" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <input className="input" name="floor" type="number" min="0" placeholder="Floor" />
        <input className="input" name="stairsFlights" type="number" min="0" defaultValue={0} placeholder="Stairs flights" />
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input type="checkbox" name="elevatorAvailable" /> Elevator
        </label>
      </div>
      <textarea className="input" name="instructions" placeholder="Access instructions (optional)" rows={2} />
    </div>
  );
}
