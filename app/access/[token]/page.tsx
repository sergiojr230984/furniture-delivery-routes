import { resolveAccessToken } from "@/lib/tracking";
import { queryOne } from "@/lib/db";
import WordMark from "@/components/WordMark";
import { submitAccessDetailsAction } from "./actions";
import type { BookingDestination } from "@/lib/types";

export default async function AccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const resolved = await resolveAccessToken(token);

  if (!resolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <WordMark />
        <p className="mt-6 text-navy-600">This link is invalid or has expired.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <WordMark />
        <p className="mt-6 text-navy-700">Thank you! Your delivery access details have been saved.</p>
      </div>
    );
  }

  const dest = await queryOne<BookingDestination>(`select * from booking_destination where booking_id = $1`, [resolved.bookingId]);
  const action = submitAccessDetailsAction.bind(null, token);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <WordMark />
        </div>
        <h1 className="mb-1 text-xl font-bold text-navy-900">Help us plan your delivery</h1>
        <p className="mb-4 text-sm text-navy-500">A few details about your home so our crew arrives ready.</p>

        <form action={action} className="card space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            <input className="input" name="floor" type="number" min="0" placeholder="Floor" defaultValue={dest?.floor ?? ""} />
            <input className="input" name="stairsFlights" type="number" min="0" defaultValue={dest?.stairs_flights ?? 0} placeholder="Stairs" />
            <label className="flex items-center gap-2 text-sm text-navy-600">
              <input type="checkbox" name="elevatorAvailable" defaultChecked={dest?.elevator_available} /> Elevator
            </label>
          </div>
          <input className="input" name="buildingHours" placeholder="Building access hours" defaultValue={dest?.building_hours ?? ""} />
          <input className="input" name="parkingNotes" placeholder="Parking notes" defaultValue={dest?.parking_notes ?? ""} />
          <input className="input" name="walkingDistanceFt" type="number" placeholder="Walking distance from parking (ft)" defaultValue={dest?.walking_distance_ft ?? ""} />
          <textarea className="input" name="instructions" rows={3} placeholder="Anything else our crew should know?" defaultValue={dest?.instructions ?? ""} />
          <button type="submit" className="btn-primary w-full">
            Save details
          </button>
        </form>
      </div>
    </div>
  );
}
