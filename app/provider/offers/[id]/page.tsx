import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { acceptOfferAction, declineOfferAction } from "../actions";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { ITEM_CATEGORY_LABELS, SERVICE_LEVEL_LABELS } from "@/lib/constants";
import type { ItemCategory, ServiceLevel } from "@/lib/constants";

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireRole("provider_owner");

  const offer = await queryOne<{
    id: string;
    booking_id: string;
    payout_amount: string;
    expires_at: string;
    status: string;
  }>(`select * from offers where id = $1 and provider_org_id = $2`, [id, user.org_id]);
  if (!offer) throw new Error("Offer not found");

  const booking = await queryOne<{
    service_level: ServiceLevel;
    priority: boolean;
    window_date: string | null;
    window_start: string | null;
    window_end: string | null;
    city: string | null;
    postal_code: string | null;
    stairs_flights: number;
  }>(
    `select b.service_level, b.priority, b.window_date, b.window_start, b.window_end, d.city, d.postal_code, d.stairs_flights
     from bookings b left join booking_destination d on d.booking_id = b.id
     where b.id = $1`,
    [offer.booking_id]
  );
  const items = await query<{ category: ItemCategory; quantity: number; assembly_required: boolean; weight_lbs: string | null }>(
    `select category, quantity, assembly_required, weight_lbs from booking_items where booking_id = $1`,
    [offer.booking_id]
  );
  const vehicles = await query<{ id: string; name: string; payload_lbs: string }>(
    `select id, name, payload_lbs from provider_vehicles where org_id = $1 and status = 'active'`,
    [user.org_id]
  );
  const crew = await query<{ id: string; full_name: string }>(
    `select id, full_name from crew_members where org_id = $1 and active = true`,
    [user.org_id]
  );

  const totalWeight = items.reduce((s, i) => s + (i.weight_lbs ? parseFloat(i.weight_lbs) * i.quantity : 0), 0);
  const assemblyNeeded = items.some((i) => i.assembly_required);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-bold text-navy-900">Offer detail</h1>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{decodeURIComponent(error)}</div>}

      <div className="card mt-4 space-y-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-orange-600">{formatMoney(offer.payout_amount)}</span>
          <span className="text-xs text-navy-400">Expires {formatDateTime(offer.expires_at)}</span>
        </div>
        <p className="text-sm text-navy-600">
          Approx. area: {booking?.city}, {booking?.postal_code?.slice(0, 3)}xx
        </p>
        <p className="text-sm text-navy-600">
          {booking?.window_date} · {booking?.window_start}–{booking?.window_end} {booking?.priority && "· Priority/dedicated"}
        </p>
        <p className="text-sm text-navy-600">Service level: {booking && SERVICE_LEVEL_LABELS[booking.service_level]}</p>
        <p className="text-sm text-navy-600">Stairs at destination: {booking?.stairs_flights ?? 0} flight(s)</p>
        <p className="text-sm text-navy-600">Assembly required: {assemblyNeeded ? "Yes" : "No"}</p>
        <p className="text-sm text-navy-600">Estimated total weight: {totalWeight} lbs</p>

        <div>
          <p className="mb-1 text-sm font-medium text-navy-700">Items</p>
          <ul className="text-sm text-navy-600">
            {items.map((it, i) => (
              <li key={i}>
                {it.quantity}× {ITEM_CATEGORY_LABELS[it.category]}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-navy-400">
          Full customer name, phone and exact address are shared once you accept this offer.
        </p>
      </div>

      {offer.status === "pending" && (
        <form action={acceptOfferAction.bind(null, offer.id)} className="card mt-4 space-y-3 p-5">
          <h2 className="font-semibold text-navy-800">Accept with</h2>
          <select className="input" name="vehicleId" required>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.payload_lbs} lbs payload)
              </option>
            ))}
          </select>
          <div className="space-y-1">
            {crew.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-navy-700">
                <input type="checkbox" name="crewMemberIds" value={c.id} /> {c.full_name}
              </label>
            ))}
          </div>
          <button type="submit" className="btn-primary w-full">
            Accept offer
          </button>
        </form>
      )}

      {offer.status === "pending" && (
        <form action={declineOfferAction.bind(null, offer.id)} className="mt-3">
          <button type="submit" className="btn-secondary w-full">
            Decline
          </button>
        </form>
      )}
    </div>
  );
}
