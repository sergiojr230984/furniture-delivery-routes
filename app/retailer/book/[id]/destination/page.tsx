import { requireRole } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { assertBookingOwnedByOrg } from "@/lib/booking-service";
import { saveDestinationAction } from "../../actions";
import BookingWizardSteps from "@/components/BookingWizardSteps";
import type { BookingDestination } from "@/lib/types";

export default async function DestinationStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(id, user.org_id);

  const dest = await queryOne<BookingDestination>(`select * from booking_destination where booking_id = $1`, [id]);
  const action = saveDestinationAction.bind(null, id);

  return (
    <div className="mx-auto max-w-lg">
      <BookingWizardSteps current="destination" />
      <h1 className="text-2xl font-bold text-navy-900">Where is it going?</h1>
      <p className="mt-1 text-sm text-navy-500">
        You can leave access details blank and send the customer a secure link to fill them in later — final
        pricing will confirm once they do.
      </p>

      <form action={action} className="card mt-6 space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <input className="input" name="customerName" placeholder="Customer name" required defaultValue={dest?.customer_name ?? ""} />
          <input className="input" name="customerPhone" placeholder="Customer phone" required defaultValue={dest?.customer_phone ?? ""} />
        </div>
        <input className="input" name="customerEmail" type="email" placeholder="Customer email (optional)" defaultValue={dest?.customer_email ?? ""} />
        <input className="input" name="addressLine1" placeholder="Street address" required defaultValue={dest?.address_line1 ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <input className="input" name="city" placeholder="City" defaultValue={dest?.city ?? "Miami"} />
          <input className="input" name="postalCode" placeholder="ZIP code" required defaultValue={dest?.postal_code ?? ""} />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-navy-100 pt-3">
          <input className="input" name="floor" type="number" min="0" placeholder="Floor" defaultValue={dest?.floor ?? ""} />
          <input className="input" name="stairsFlights" type="number" min="0" defaultValue={dest?.stairs_flights ?? 0} placeholder="Stairs flights" />
          <label className="flex items-center gap-2 text-sm text-navy-600">
            <input type="checkbox" name="elevatorAvailable" defaultChecked={dest?.elevator_available} /> Elevator
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input type="checkbox" name="elevatorReserved" defaultChecked={dest?.elevator_reserved} /> Reserve elevator for delivery window
        </label>
        <input className="input" name="buildingHours" placeholder="Building access hours (optional)" defaultValue={dest?.building_hours ?? ""} />
        <input className="input" name="parkingNotes" placeholder="Parking notes (optional)" defaultValue={dest?.parking_notes ?? ""} />
        <input className="input" name="walkingDistanceFt" type="number" placeholder="Walking distance from parking (ft, optional)" defaultValue={dest?.walking_distance_ft ?? ""} />
        <textarea className="input" name="instructions" rows={2} placeholder="Special instructions (optional)" defaultValue={dest?.instructions ?? ""} />

        <button type="submit" className="btn-primary w-full">
          Continue
        </button>
      </form>
    </div>
  );
}
