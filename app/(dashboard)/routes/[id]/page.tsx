import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  X,
  MapPin,
  Trash2,
  Sparkles,
  Clock,
  AlertTriangle,
  Route as RouteIcon,
  Gauge,
} from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import StatusBadge from "@/components/StatusBadge";
import {
  ROUTE_STATUSES,
  ROUTE_STATUS_LABELS,
  type DeliveryStatus,
} from "@/lib/constants";
import {
  updateRoute,
  addStop,
  removeStop,
  moveStop,
  deleteRoute,
  optimizeRouteAction,
} from "../actions";
import type { Vehicle, Driver } from "@/lib/types";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: route } = await supabase
    .from("routes")
    .select("*")
    .eq("id", id)
    .single();
  if (!route) notFound();

  const [stopsRes, vehiclesRes, driversRes] = await Promise.all([
    supabase
      .from("route_stops")
      .select("*, delivery_order:delivery_orders(*, customer:customers(name))")
      .eq("route_id", id)
      .order("stop_order"),
    supabase.from("vehicles").select("*").order("name"),
    supabase.from("drivers").select("*").eq("active", true).order("full_name"),
  ]);

  const stops = stopsRes.data ?? [];
  const vehicles = (vehiclesRes.data ?? []) as Vehicle[];
  const drivers = (driversRes.data ?? []) as Driver[];

  // Candidate orders: same date, not already on this route.
  const assignedIds = stops.map((s) => s.delivery_order_id);
  let candQuery = supabase
    .from("delivery_orders")
    .select("id, order_number, status, contact_name, city, customer:customers(name)")
    .eq("scheduled_date", route.route_date)
    .order("created_at");
  if (assignedIds.length > 0) {
    candQuery = candQuery.not("id", "in", `(${assignedIds.join(",")})`);
  }
  const { data: candidates } = await candQuery;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/routes" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to routes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{route.name}</h1>
          <p className="text-sm text-gray-500">{route.route_date}</p>
        </div>
        <form action={deleteRoute}>
          <input type="hidden" name="id" value={route.id} />
          <button type="submit" className="btn-secondary text-red-600">
            <Trash2 className="h-4 w-4" /> Delete route
          </button>
        </form>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Assignment */}
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">Assignment</h2>
          <form action={updateRoute} className="space-y-3">
            <input type="hidden" name="id" value={route.id} />
            <div>
              <label className="label">Vehicle</label>
              <select name="vehicle_id" className="input" defaultValue={route.vehicle_id ?? ""}>
                <option value="">—</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Driver</label>
              <select name="driver_id" className="input" defaultValue={route.driver_id ?? ""}>
                <option value="">—</option>
                {drivers.filter((d) => d.crew_type === "driver").map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Helper</label>
              <select name="helper_id" className="input" defaultValue={route.helper_id ?? ""}>
                <option value="">—</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input" defaultValue={route.status}>
                {ROUTE_STATUSES.map((s) => (
                  <option key={s} value={s}>{ROUTE_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start time</label>
                <input name="start_time" type="time" className="input" defaultValue={route.start_time?.slice(0, 5) ?? "08:00"} />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
                <input name="avoid_tolls" type="checkbox" defaultChecked={route.avoid_tolls} className="h-4 w-4" />
                Avoid tolls
              </label>
            </div>
            <button type="submit" className="btn-primary w-full">Save assignment</button>
          </form>

          {/* Optimization */}
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <form action={optimizeRouteAction}>
              <input type="hidden" name="id" value={route.id} />
              <button type="submit" className="btn-success w-full">
                <Sparkles className="h-4 w-4" /> Optimize route
              </button>
            </form>
            {(route.total_distance_km != null || route.optimized_at) && (
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="flex items-center justify-center gap-1 text-gray-500">
                    <RouteIcon className="h-3.5 w-3.5" /> Distance
                  </p>
                  <p className="font-semibold">{route.total_distance_km ?? "—"} km</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="flex items-center justify-center gap-1 text-gray-500">
                    <Gauge className="h-3.5 w-3.5" /> Duration
                  </p>
                  <p className="font-semibold">
                    {route.total_duration_min != null
                      ? `${Math.floor(route.total_duration_min / 60)}h ${route.total_duration_min % 60}m`
                      : "—"}
                  </p>
                </div>
              </div>
            )}
            {route.optimized_at && (
              <p className="text-center text-xs text-gray-400">
                Optimized {format(new Date(route.optimized_at), "MMM d, HH:mm")}
              </p>
            )}
          </div>
        </section>

        {/* Stops */}
        <section className="card space-y-3 p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">Stops ({stops.length})</h2>
          {stops.length === 0 ? (
            <p className="text-sm text-gray-500">No stops yet. Add orders below.</p>
          ) : (
            <ol className="space-y-2">
              {stops.map((s, idx) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.delivery_order?.order_number} ·{" "}
                      {s.delivery_order?.customer?.name || s.delivery_order?.contact_name || "—"}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                      {s.eta && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          ETA {format(new Date(s.eta), "HH:mm")}
                        </span>
                      )}
                      {s.distance_from_prev_km != null && (
                        <span>{s.distance_from_prev_km} km</span>
                      )}
                      {s.predicted_delay_min > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" /> {s.predicted_delay_min}m late
                        </span>
                      )}
                      {s.delivery_order?.city ? <span>{s.delivery_order.city}</span> : null}
                    </p>
                  </div>
                  {s.delivery_order?.status && (
                    <StatusBadge status={s.delivery_order.status as DeliveryStatus} />
                  )}
                  <div className="flex items-center gap-1">
                    <form action={moveStop}>
                      <input type="hidden" name="route_id" value={route.id} />
                      <input type="hidden" name="stop_id" value={s.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button className="btn-secondary px-2 py-1" disabled={idx === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </form>
                    <form action={moveStop}>
                      <input type="hidden" name="route_id" value={route.id} />
                      <input type="hidden" name="stop_id" value={s.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button className="btn-secondary px-2 py-1" disabled={idx === stops.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </form>
                    <form action={removeStop}>
                      <input type="hidden" name="route_id" value={route.id} />
                      <input type="hidden" name="stop_id" value={s.id} />
                      <button className="btn-secondary px-2 py-1 text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Add stop */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">
              Add a delivery to this route
            </h3>
            {!candidates || candidates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No unassigned deliveries scheduled for {route.route_date}.
              </p>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => {
                  const cust = c.customer as { name?: string } | { name?: string }[] | null;
                  const custName = Array.isArray(cust) ? cust[0]?.name : cust?.name;
                  return (
                    <form key={c.id} action={addStop} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-2.5">
                      <input type="hidden" name="route_id" value={route.id} />
                      <input type="hidden" name="delivery_order_id" value={c.id} />
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="truncate">
                          {c.order_number} · {custName || c.contact_name || "—"}
                          {c.city ? ` · ${c.city}` : ""}
                        </span>
                      </span>
                      <button type="submit" className="btn-secondary shrink-0 px-3 py-1 text-sm">
                        Add
                      </button>
                    </form>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
