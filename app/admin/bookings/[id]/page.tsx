import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatWallTime } from "@/lib/time";
import { signedFileUrl } from "@/lib/storage";
import type { Booking, BookingDestination, BookingItem, BookingPickup } from "@/lib/types";

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("platform_admin", "dispatcher");

  const booking = await queryOne<Booking & { retailer_name: string }>(
    `select b.*, o.name as retailer_name from bookings b join organizations o on o.id = b.retailer_org_id where b.id = $1`,
    [id]
  );
  if (!booking) throw new Error("Not found");

  const pickups = await query<BookingPickup>(`select * from booking_pickups where booking_id = $1 order by sequence`, [id]);
  const destination = await queryOne<BookingDestination>(`select * from booking_destination where booking_id = $1`, [id]);
  const items = await query<BookingItem>(`select * from booking_items where booking_id = $1`, [id]);
  const assignment = await queryOne<{ id: string; status: string; provider_name: string; is_internal: boolean; vehicle_name: string | null }>(
    `select a.id, a.status, o.name as provider_name, o.is_internal_fleet as is_internal, v.name as vehicle_name
     from assignments a join organizations o on o.id = a.provider_org_id
     left join provider_vehicles v on v.id = a.vehicle_id
     where a.booking_id = $1`,
    [id]
  );
  const crew = assignment
    ? await query<{ full_name: string }>(
        `select cm.full_name from assignment_crew ac join crew_members cm on cm.id = ac.crew_member_id where ac.assignment_id = $1`,
        [assignment.id]
      )
    : [];
  const offers = await query<{ id: string; provider_name: string; status: string; payout_amount: string; expires_at: string }>(
    `select of.id, o.name as provider_name, of.status, of.payout_amount, of.expires_at
     from offers of join organizations o on o.id = of.provider_org_id where of.booking_id = $1 order by of.created_at`,
    [id]
  );
  const evidence = await query<{ id: string; stage: string; kind: string; file_path: string | null }>(
    `select id, stage, kind, file_path from job_evidence where booking_id = $1 order by created_at`,
    [id]
  );
  const history = await query<{ to_status: string; notes: string | null; created_at: string }>(
    `select to_status, notes, created_at from status_events where booking_id = $1 order by created_at`,
    [id]
  );
  const payments = await query<{ status: string; amount: string; is_demo: boolean }>(
    `select status, amount, is_demo from payments where booking_id = $1`,
    [id]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{booking.booking_number}</h1>
          <p className="text-sm text-navy-500">{booking.retailer_name}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Window</h2>
          <p className="text-sm text-navy-600">
            {booking.window_date ?? "TBD"} {booking.window_start && `· ${formatWallTime(booking.window_start)}–${formatWallTime(booking.window_end)}`}
          </p>
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Payment</h2>
          {payments.map((p, i) => (
            <p key={i} className="text-sm text-navy-600">
              {formatMoney(p.amount)} — {p.status} {p.is_demo && "(demo)"}
            </p>
          ))}
        </div>
      </div>

      {assignment && (
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Assignment</h2>
          <p className="text-sm text-navy-600">
            {assignment.is_internal ? "Belliza internal crew" : assignment.provider_name} — {assignment.vehicle_name} ({assignment.status.replace(/_/g, " ")})
          </p>
          <p className="text-xs text-navy-400">Crew: {crew.map((c) => c.full_name).join(", ") || "—"}</p>
        </div>
      )}

      {offers.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Offers</h2>
          <ul className="space-y-1 text-sm text-navy-600">
            {offers.map((o) => (
              <li key={o.id} className="flex justify-between">
                <span>{o.provider_name} — {formatMoney(o.payout_amount)}</span>
                <span className="text-xs">{o.status} · expires {formatDateTime(o.expires_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Pickups</h2>
        {pickups.map((p) => (
          <p key={p.id} className="text-sm text-navy-600">
            {p.pickup_type} — {p.address_line1 ?? `warehouse (${p.warehouse_order_number})`}, {p.city}
          </p>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Destination</h2>
        <p className="text-sm text-navy-600">
          {destination?.customer_name} — {destination?.address_line1}, {destination?.city}
        </p>
        <p className="text-xs text-navy-400">{destination?.customer_phone}</p>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-navy-800">Items</h2>
        <ul className="text-sm text-navy-600">
          {items.map((it) => (
            <li key={it.id}>
              {it.quantity}× {it.name} {it.needs_review && <span className="text-amber-600">(review: {it.review_reason})</span>}
            </li>
          ))}
        </ul>
      </div>

      {booking.quote && (
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Quote</h2>
          <ul className="divide-y divide-navy-100 text-sm">
            {booking.quote.lineItems.map((li, i) => (
              <li key={i} className="flex justify-between py-1">
                <span>{li.label}</span>
                <span>{formatMoney(li.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-navy-200 pt-2 text-sm">
            <span className="font-bold">Retailer total</span>
            <span className="font-bold">{formatMoney(booking.quote.total)}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-navy-500">
            <span>Provider payout</span>
            <span>{formatMoney(booking.quote.providerPayout)}</span>
          </div>
          <div className="flex justify-between text-xs text-navy-500">
            <span>Processing fee estimate</span>
            <span>{formatMoney(booking.quote.processingFeeEstimate)}</span>
          </div>
        </div>
      )}

      {evidence.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-navy-800">Job evidence</h2>
          <div className="flex flex-wrap gap-2">
            {evidence
              .filter((e) => e.kind === "photo" || e.kind === "signature")
              .map((e) =>
                e.file_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={e.id} src={signedFileUrl(e.file_path)} alt={e.stage} className="h-20 w-20 rounded-lg object-cover" title={e.stage} />
                ) : null
              )}
          </div>
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
