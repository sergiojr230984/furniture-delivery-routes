import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { assertBookingOwnedByOrg } from "@/lib/booking-service";
import StatusBadge from "@/components/StatusBadge";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatWallTime } from "@/lib/time";
import { trackingUrl } from "@/lib/tracking";
import { fileClaimAction } from "./claim-actions";
import type { Booking, BookingDestination, BookingItem, BookingPickup, Claim } from "@/lib/types";

export default async function RetailerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("retailer_owner", "retailer_staff");
  await assertBookingOwnedByOrg(id, user.org_id);

  const booking = await queryOne<Booking>(`select * from bookings where id = $1`, [id]);
  if (!booking) throw new Error("Booking not found");

  const pickups = await query<BookingPickup>(`select * from booking_pickups where booking_id = $1 order by sequence`, [id]);
  const destination = await queryOne<BookingDestination>(`select * from booking_destination where booking_id = $1`, [id]);
  const items = await query<BookingItem>(`select * from booking_items where booking_id = $1`, [id]);
  const token = await queryOne<{ token: string }>(`select token from tracking_tokens where booking_id = $1 order by created_at desc limit 1`, [id]);
  const assignment = await queryOne<{ provider_name: string; vehicle_name: string | null; status: string }>(
    `select o.name as provider_name, v.name as vehicle_name, a.status
     from assignments a join organizations o on o.id = a.provider_org_id
     left join provider_vehicles v on v.id = a.vehicle_id
     where a.booking_id = $1`,
    [id]
  );
  const history = await query<{ to_status: string; notes: string | null; created_at: string }>(
    `select to_status, notes, created_at from status_events where booking_id = $1 order by created_at`,
    [id]
  );
  const claims = await query<Claim>(`select * from claims where booking_id = $1 order by created_at desc`, [id]);
  const canClaim = ["delivered", "partially_delivered", "failed"].includes(booking.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{booking.booking_number}</h1>
          <p className="text-sm text-navy-500">{destination?.customer_name}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {token && (
        <div className="card p-4">
          <p className="text-sm font-medium text-navy-700">Customer tracking link</p>
          <a href={trackingUrl(token.token)} className="break-all text-sm text-orange-600 underline">
            {trackingUrl(token.token)}
          </a>
        </div>
      )}

      {assignment && (
        <div className="card p-4 text-sm">
          <p className="font-medium text-navy-700">Fulfilled by</p>
          <p className="text-navy-600">
            {assignment.provider_name}
            {assignment.vehicle_name ? ` — ${assignment.vehicle_name}` : ""} ({assignment.status.replace(/_/g, " ")})
          </p>
        </div>
      )}

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Window</h2>
        <p className="text-sm text-navy-600">
          {booking.window_date ?? "TBD"} {booking.window_start && `· ${formatWallTime(booking.window_start)}–${formatWallTime(booking.window_end)}`}
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Pickups</h2>
        {pickups.map((p) => (
          <p key={p.id} className="text-sm text-navy-600">
            {p.pickup_type === "warehouse" ? `Belliza warehouse (order ${p.warehouse_order_number})` : `${p.address_line1}, ${p.city}`}
          </p>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Destination</h2>
        <p className="text-sm text-navy-600">
          {destination?.address_line1}, {destination?.city} {destination?.postal_code}
        </p>
        {!destination?.access_completed && <p className="mt-1 text-xs text-amber-600">Access details not yet confirmed by customer.</p>}
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Items</h2>
        <ul className="space-y-1 text-sm text-navy-600">
          {items.map((it) => (
            <li key={it.id}>
              {it.quantity}× {it.name}
            </li>
          ))}
        </ul>
      </div>

      {booking.quote && (
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Receipt</h2>
          <ul className="divide-y divide-navy-100 text-sm">
            {booking.quote.lineItems.map((li, i) => (
              <li key={i} className="flex justify-between py-1">
                <span className="text-navy-600">{li.label}</span>
                <span>{formatMoney(li.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-navy-200 pt-2 font-bold text-navy-900">
            <span>Total</span>
            <span>{formatMoney(booking.price_total ?? 0)}</span>
          </div>
        </div>
      )}

      {(canClaim || claims.length > 0) && (
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Claims</h2>
          {claims.map((c) => (
            <div key={c.id} className="mb-2 rounded-lg bg-navy-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{c.status.replace(/_/g, " ")}</span>
                {c.adjustment_amount && <span>{formatMoney(c.adjustment_amount)}</span>}
              </div>
              <p className="text-navy-600">{c.description}</p>
              {c.decision_notes && <p className="text-xs text-navy-400">Decision: {c.decision_notes}</p>}
            </div>
          ))}
          {canClaim && (
            <form action={fileClaimAction.bind(null, booking.id)} className="space-y-2">
              <textarea className="input" name="description" rows={2} placeholder="Describe the issue" required />
              <input className="input" name="requestedAmount" type="number" step="0.01" placeholder="Requested amount (optional)" />
              <button type="submit" className="btn-secondary w-full">
                File a claim
              </button>
            </form>
          )}
        </div>
      )}

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">History</h2>
        <ul className="space-y-1 text-sm text-navy-600">
          {history.map((h, i) => (
            <li key={i}>
              {formatDateTime(h.created_at)} — {h.to_status.replace(/_/g, " ")} {h.notes && `(${h.notes})`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
