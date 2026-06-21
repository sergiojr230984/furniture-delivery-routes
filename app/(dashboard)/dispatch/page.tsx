import Link from "next/link";
import { Zap, MapPin, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { ROUTE_STATUS_LABELS, type RouteStatus } from "@/lib/constants";
import { autoDispatchAction, autoDispatchAllAction } from "./actions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string; dispatched?: string; failed?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || todayISO();
  const supabase = await createClient();

  const [pendingRes, routesRes] = await Promise.all([
    supabase
      .from("delivery_orders")
      .select("*, customer:customers(name)")
      .eq("scheduled_date", date)
      .eq("on_demand", true)
      .eq("status", "pending")
      .order("sla_deadline", { ascending: true, nullsFirst: false }),
    supabase
      .from("routes")
      .select(
        "id, name, status, total_distance_km, total_duration_min, vehicle:vehicles(name), route_stops(id, predicted_delay_min)"
      )
      .eq("route_date", date)
      .in("status", ["planning", "assigned", "in_progress"])
      .order("created_at"),
  ]);

  const pending = pendingRes.data ?? [];
  const routes = routesRes.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auto-Dispatch</h1>
          <p className="text-sm text-gray-500">
            Weave on-demand orders into existing routes automatically.
          </p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <input type="date" name="date" defaultValue={date} className="input" />
          <button className="btn-secondary">Go</button>
        </form>
      </div>

      {params.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {params.error}
        </div>
      )}
      {params.dispatched && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Dispatched {params.dispatched} order(s)
          {Number(params.failed) > 0 ? `, ${params.failed} could not be placed.` : "."}
        </div>
      )}

      {/* On-demand queue */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h2 className="text-lg font-semibold">
            On-demand queue ({pending.length})
          </h2>
          {pending.length > 0 && (
            <form action={autoDispatchAllAction}>
              <input type="hidden" name="date" value={date} />
              <button className="btn-primary">
                <Zap className="h-4 w-4" /> Auto-dispatch all
              </button>
            </form>
          )}
        </div>
        {pending.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No unassigned on-demand orders for {date}.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link href={`/deliveries/${o.id}`} className="font-medium hover:underline">
                    {o.order_number}
                  </Link>
                  <p className="flex items-center gap-1 truncate text-sm text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {o.customer?.name || o.contact_name || "—"}
                    {o.city ? ` · ${o.city}` : ""}
                    {o.latitude == null && (
                      <span className="ml-1 text-amber-600">(no coordinates)</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {o.sla_deadline && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      SLA {format(new Date(o.sla_deadline), "HH:mm")}
                    </span>
                  )}
                  <form action={autoDispatchAction}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <button className="btn-secondary text-sm">
                      <Zap className="h-4 w-4" /> Dispatch
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Active routes */}
      <section className="card">
        <div className="border-b border-gray-100 p-4">
          <h2 className="text-lg font-semibold">Active routes ({routes.length})</h2>
        </div>
        {routes.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No active routes for {date}. Create a route so orders can be dispatched.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {routes.map((r) => {
              const stops = r.route_stops ?? [];
              const lateCount = stops.filter((s) => s.predicted_delay_min > 0).length;
              const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
              return (
                <li key={r.id}>
                  <Link href={`/routes/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-sm text-gray-500">
                        {vehicle?.name || "No vehicle"} · {stops.length} stops
                        {r.total_distance_km != null ? ` · ${r.total_distance_km} km` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lateCount > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" /> {lateCount} at risk
                        </span>
                      )}
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {ROUTE_STATUS_LABELS[r.status as RouteStatus]}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
