import { requireRole } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { assertBookingOwnedByOrg } from "@/lib/booking-service";
import { saveServiceAction } from "../../actions";
import BookingWizardSteps from "@/components/BookingWizardSteps";
import { SERVICE_LEVELS, SERVICE_LEVEL_LABELS, SERVICE_LEVEL_DESCRIPTIONS } from "@/lib/constants";
import type { Booking } from "@/lib/types";

export default async function ServiceStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(id, user.org_id);

  const booking = await queryOne<Booking>(`select * from bookings where id = $1`, [id]);
  const action = saveServiceAction.bind(null, id);

  return (
    <div className="mx-auto max-w-lg">
      <BookingWizardSteps current="service" />
      <h1 className="text-2xl font-bold text-navy-900">Service level</h1>

      <form action={action} className="card mt-6 space-y-4 p-5">
        <div className="space-y-2">
          {SERVICE_LEVELS.map((level) => (
            <label key={level} className="flex cursor-pointer gap-3 rounded-lg border border-navy-100 p-3 hover:bg-navy-50">
              <input type="radio" name="serviceLevel" value={level} defaultChecked={booking?.service_level === level || (level === "curbside" && !booking?.service_level)} className="mt-1" />
              <span>
                <span className="block font-medium text-navy-800">{SERVICE_LEVEL_LABELS[level]}</span>
                <span className="block text-xs text-navy-500">{SERVICE_LEVEL_DESCRIPTIONS[level]}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-2 border-t border-navy-100 pt-3">
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" name="priority" defaultChecked={booking?.priority} /> Priority / dedicated window (faster, dedicated crew)
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" name="debrisRemoval" defaultChecked={booking?.debris_removal} /> Debris / packaging removal
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" name="oldFurnitureRemoval" defaultChecked={booking?.old_furniture_removal} /> Old furniture removal (haul-away)
          </label>
        </div>

        <button type="submit" className="btn-primary w-full">
          Get quote
        </button>
      </form>
    </div>
  );
}
