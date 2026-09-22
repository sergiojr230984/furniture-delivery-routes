import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDate, formatWallTime, formatDateTime } from "@/lib/time";
import { widenOffersAction } from "../organizations/actions";
import { batchRouteAction, reoptimizeRouteAction } from "./actions";

export default async function DispatchBoardPage() {
  await requireRole("platform_admin", "dispatcher");

  const awaitingAcceptance = await query<{
    id: string;
    booking_number: string;
    retailer_name: string;
    window_date: string | null;
    pending_offers: string;
  }>(
    `select b.id, b.booking_number, o.name as retailer_name, b.window_date,
            (select count(*) from offers of where of.booking_id = b.id and of.status = 'pending' and of.expires_at > now()) as pending_offers
     from bookings b join organizations o on o.id = b.retailer_org_id
     where b.status = 'awaiting_acceptance' order by b.window_date`
  );

  const todaysJobs = await query<{
    id: string;
    booking_number: string;
    status: string;
    provider_name: string;
    is_internal: boolean;
    window_start: string | null;
    window_end: string | null;
  }>(
    `select a.id, b.booking_number, a.status, o.name as provider_name, o.is_internal_fleet as is_internal, b.window_start, b.window_end
     from assignments a
     join bookings b on b.id = a.booking_id
     join organizations o on o.id = a.provider_org_id
     where b.window_date = current_date
     order by b.window_start`
  );

  const batchable = await query<{
    provider_org_id: string;
    provider_name: string;
    vehicle_id: string;
    vehicle_name: string;
    window_date: string;
    job_count: string;
  }>(
    `select a.provider_org_id, o.name as provider_name, a.vehicle_id, v.name as vehicle_name, b.window_date, count(*) as job_count
     from assignments a
     join bookings b on b.id = a.booking_id
     join organizations o on o.id = a.provider_org_id
     join provider_vehicles v on v.id = a.vehicle_id
     where a.route_id is null and a.status not in ('completed','failed','cancelled') and b.window_date >= current_date
     group by a.provider_org_id, o.name, a.vehicle_id, v.name, b.window_date
     having count(*) >= 2
     order by b.window_date`
  );

  const activeRoutes = await query<{
    id: string;
    provider_name: string;
    vehicle_name: string;
    route_date: string;
    total_distance_mi: string | null;
    total_duration_min: number | null;
    stop_count: string;
  }>(
    `select r.id, o.name as provider_name, v.name as vehicle_name, r.route_date, r.total_distance_mi, r.total_duration_min,
            (select count(*) from route_stops rs where rs.route_id = r.id) as stop_count
     from routes r join organizations o on o.id = r.provider_org_id
     left join provider_vehicles v on v.id = r.vehicle_id
     where r.status = 'planning' order by r.route_date`
  );

  const expiredDocsProviders = await query<{ name: string; doc_type: string; expires_at: string }>(
    `select o.name, d.doc_type, d.expires_at from provider_documents d
     join organizations o on o.id = d.org_id
     where d.expires_at < current_date + interval '14 days'
     order by d.expires_at`
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Dispatch Board</h1>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold text-navy-800">Awaiting provider acceptance</h2>
        {awaitingAcceptance.length === 0 && <p className="text-sm text-navy-500">Nothing waiting on a provider.</p>}
        <ul className="divide-y divide-navy-100">
          {awaitingAcceptance.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2 text-sm">
              <Link href={`/admin/bookings/${b.id}`} className="text-navy-700 hover:underline">
                {b.booking_number} — {b.retailer_name} {b.window_date && `(${formatDate(b.window_date)})`}
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-navy-400">{b.pending_offers} pending offer(s)</span>
                {Number(b.pending_offers) === 0 && (
                  <form action={widenOffersAction.bind(null, b.id)}>
                    <button type="submit" className="btn-secondary !px-2 !py-1 text-xs">
                      Widen pool / raise payout
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold text-navy-800">Today&apos;s jobs (list view)</h2>
        <p className="mb-2 text-xs text-navy-400">
          Map view requires NEXT_PUBLIC_MAPBOX_TOKEN — not configured, so list/calendar views are shown instead.
        </p>
        {todaysJobs.length === 0 && <p className="text-sm text-navy-500">No jobs scheduled for today.</p>}
        <ul className="divide-y divide-navy-100">
          {todaysJobs.map((j) => (
            <li key={j.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {j.window_start && formatWallTime(j.window_start)}–{j.window_end && formatWallTime(j.window_end)} · {j.booking_number} —{" "}
                {j.is_internal ? "Belliza crew" : j.provider_name}
              </span>
              <span className="text-xs uppercase tracking-wide text-orange-600">{j.status.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      </section>

      {batchable.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-navy-800">Multi-stop route batching</h2>
          <p className="mb-2 text-xs text-navy-400">
            Same vehicle, same day, 2+ jobs not yet batched. Batching sequences stops with a nearest-neighbour +
            2-opt heuristic — a starting point for manual adjustment, not a claimed optimum.
          </p>
          <ul className="divide-y divide-navy-100">
            {batchable.map((b, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {formatDate(b.window_date)} · {b.provider_name} — {b.vehicle_name} ({b.job_count} jobs)
                </span>
                <form action={batchRouteAction.bind(null, b.provider_org_id, b.vehicle_id, b.window_date)}>
                  <button type="submit" className="btn-secondary !px-2 !py-1 text-xs">
                    Batch into route
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeRoutes.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-navy-800">Planned routes</h2>
          <ul className="divide-y divide-navy-100">
            {activeRoutes.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {formatDate(r.route_date)} · {r.provider_name} — {r.vehicle_name} · {r.stop_count} stops
                  {r.total_distance_mi && ` · ${r.total_distance_mi} mi · ${r.total_duration_min} min`}
                </span>
                <form action={reoptimizeRouteAction.bind(null, r.id)}>
                  <button type="submit" className="btn-secondary !px-2 !py-1 text-xs">
                    Re-optimize
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {expiredDocsProviders.length > 0 && (
        <section className="card border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 font-semibold text-amber-800">Provider documents expiring soon</h2>
          <ul className="text-sm text-amber-800">
            {expiredDocsProviders.map((d, i) => (
              <li key={i}>
                {d.name} — {d.doc_type.replace(/_/g, " ")} expires {formatDateTime(d.expires_at)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
