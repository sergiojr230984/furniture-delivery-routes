import { resolveTrackingToken } from "@/lib/tracking";
import { queryOne, query } from "@/lib/db";
import WordMark from "@/components/WordMark";
import LocaleSwitch from "@/components/LocaleSwitch";
import StatusBadge from "@/components/StatusBadge";
import LiveMap from "@/components/LiveMapClient";
import type { MapMarker } from "@/components/LiveMap";
import { formatDate, formatWallTime, formatDateTime } from "@/lib/time";
import { getLocale, t } from "@/lib/i18n";
import type { Booking, BookingDestination } from "@/lib/types";

const TRACKABLE_STATUSES = new Set(["en_route_pickup", "en_route_delivery"]);

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveTrackingToken(token);
  const locale = await getLocale();

  if (!resolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <WordMark />
        <p className="mt-6 text-navy-600">{t(locale, "track_not_found")}</p>
      </div>
    );
  }

  const booking = await queryOne<Booking>(`select * from bookings where id = $1`, [resolved.bookingId]);
  const destination = await queryOne<BookingDestination>(`select * from booking_destination where booking_id = $1`, [resolved.bookingId]);
  const assignment = await queryOne<{
    provider_name: string;
    is_internal: boolean;
    last_lat: number | null;
    last_lng: number | null;
    last_location_at: string | null;
  }>(
    `select o.name as provider_name, o.is_internal_fleet as is_internal, a.last_lat, a.last_lng, a.last_location_at
     from assignments a join organizations o on o.id = a.provider_org_id
     where a.booking_id = $1`,
    [resolved.bookingId]
  );
  const history = await query<{ to_status: string; created_at: string }>(
    `select to_status, created_at from status_events where booking_id = $1 order by created_at`,
    [resolved.bookingId]
  );

  if (!booking) return null;

  const markers: MapMarker[] = [];
  if (assignment?.last_lat != null && assignment?.last_lng != null && TRACKABLE_STATUSES.has(booking.status)) {
    markers.push({ lat: assignment.last_lat, lng: assignment.last_lng, label: "Your delivery crew", kind: "driver" });
  }
  if (destination?.latitude != null && destination?.longitude != null) {
    markers.push({ lat: destination.latitude, lng: destination.longitude, label: "Delivery address", kind: "destination" });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <WordMark />
          <LocaleSwitch locale={locale} />
        </div>

        <div className="card p-5 text-center">
          <p className="text-sm text-navy-400">Order {booking.booking_number}</p>
          <div className="my-3 flex justify-center">
            <StatusBadge status={booking.status} />
          </div>
          {booking.window_date && (
            <p className="text-navy-700">
              Arrival window: {formatDate(booking.window_date)}, {formatWallTime(booking.window_start)}–{formatWallTime(booking.window_end)}
            </p>
          )}
        </div>

        {assignment && (
          <div className="card mt-4 p-5">
            <h2 className="mb-1 font-semibold text-navy-800">Your delivery crew</h2>
            <p className="text-sm text-navy-600">{assignment.is_internal ? "Belliza Delivery crew" : assignment.provider_name}</p>
          </div>
        )}

        {markers.length > 0 && (
          <div className="card mt-4 overflow-hidden p-0">
            <LiveMap markers={markers} />
            {assignment?.last_location_at && (
              <p className="p-3 text-center text-xs text-navy-400">Location updated {formatDateTime(assignment.last_location_at)}</p>
            )}
          </div>
        )}

        {destination?.instructions && (
          <div className="card mt-4 p-5">
            <h2 className="mb-1 font-semibold text-navy-800">Delivery instructions</h2>
            <p className="text-sm text-navy-600">{destination.instructions}</p>
          </div>
        )}

        <div className="card mt-4 p-5">
          <h2 className="mb-2 font-semibold text-navy-800">Status history</h2>
          <ul className="space-y-1 text-sm text-navy-600">
            {history.map((h, i) => (
              <li key={i}>
                {formatDate(h.created_at)} — {h.to_status.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>

        <div className="card mt-4 p-5 text-center text-sm text-navy-500">
          Questions about your delivery? Contact the store where you purchased your furniture.
        </div>
      </div>
    </div>
  );
}
